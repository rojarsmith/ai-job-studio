import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mentions, extractKeywords, keywordCoverage, parseCv, checkSections, checkRoles, checkLayout, atsCheck, atsFileName, postingText, checkApplication, dateFormOf } from '../lib/ats.mjs';
import { markdownToDocxBuffer, markdownToDocx, docxText, zip, unzip, runs } from '../lib/docx.mjs';
import { parseReview } from '../lib/tailor.mjs';

const GOOD = `# Lin Mei
mei@example.com · +886-912-345-678 · Taipei · linkedin.com/in/linmei

## Summary
Backend engineer, 8 years, Go and Kubernetes on AWS.

## Skills
Go, Kubernetes, AWS, PostgreSQL, CI/CD, Terraform

## Experience
### Acme — Senior Backend Engineer
2021-03 to present · Taipei
- Cut p99 latency 40% by moving the order service to Go on **Kubernetes**
- Led migration to AWS EKS with Terraform

### Beta Co — Backend Engineer
2017-06 to 2021-02 · Hsinchu
- Built PostgreSQL billing pipeline handling 2M rows/day

## Education
### NTU — B.S. Computer Science
2013-09 to 2017-06
`;

test('mentions: punctuation-safe, alias-aware', () => {
  assert.ok(mentions('worked with C++ and C#', 'c++'));
  assert.ok(mentions('worked with C++ and C#', 'C#'));
  assert.ok(!mentions('worked with C++', 'c'));
  assert.ok(mentions('deployed on k8s', 'Kubernetes'));
  assert.ok(mentions('Node.js services', 'nodejs'));
  assert.ok(mentions('a CI/CD pipeline', 'ci/cd'));
  assert.ok(!mentions('golang', 'lang'));
});
test('extractKeywords: lexicon, acronyms, CamelCase; ordered by first appearance; stop-acronyms skipped', () => {
  const k = extractKeywords('We need Go and Kubernetes experience. OKR driven. PostgreSQL, GraphQL and OpenTelemetry. You ARE great. Uses K8s.');
  assert.deepEqual(k.slice(0, 3), ['go', 'kubernetes', 'okr']);
  assert.ok(k.includes('postgresql') && k.includes('graphql') && k.includes('opentelemetry'));
  assert.ok(!k.includes('are'));
  assert.equal(k.filter((x) => x === 'kubernetes').length, 1);
});
test('keywordCoverage: hits, misses, fixable only when reviewer said supported', () => {
  const rows = parseReview('| keyword | evidence | verdict |\n| --- | --- | --- |\n| Go | cv | supported |\n| Kafka | none | gap |\n| Terraform | cv | supported |\n| k8s | cv | supported |\nverdict: pass').rows;
  const c = keywordCoverage(rows, 'Go services on Kubernetes');
  assert.deepEqual(c.hit, ['Go', 'k8s']);
  assert.deepEqual(c.miss, ['Kafka', 'Terraform']);
  assert.deepEqual(c.fixable, ['Terraform']);
  assert.equal(c.ratio, 0.5);
  assert.equal(keywordCoverage([], 'x').ratio, 1);
});
test('parseCv: name, contact, sections, roles, meta, layout counters', () => {
  const cv = parseCv(GOOD);
  assert.equal(cv.name, 'Lin Mei');
  assert.match(cv.contact, /mei@example.com/);
  assert.deepEqual(cv.sections.map((s) => s.key), ['summary', 'skills', 'experience', 'education']);
  const exp = cv.sections[2];
  assert.equal(exp.roles.length, 2);
  assert.equal(exp.roles[0].meta, '2021-03 to present · Taipei');
  assert.equal(exp.roles[0].bullets, 2);
  assert.equal(cv.tables + cv.images + cv.html + cv.emoji, 0);
  const bad = parseCv('# X\n\n| a | b |\n| - | - |\n![pic](x.png)\n<div>hi</div>\n🚀 go\n');
  assert.deepEqual([bad.tables, bad.images, bad.html, bad.emoji], [2, 1, 1, 1]);
});
test('checkSections: standard names in en/zh, required Skills + Experience, duplicates, contact email', () => {
  assert.deepEqual(checkSections(parseCv(GOOD)).problems, []);
  const zh = parseCv('# 林美\nmei@x.y · 0912\n## 摘要\nx\n## 技能\nGo\n## 工作經歷\n### 公司 — 工程師\n2020年3月 至今\n- a\n## 學歷\nNTU\n');
  assert.deepEqual(checkSections(zh).problems, []);
  const r = checkSections(parseCv('# A\nno email here\n## My Journey\nx\n## Skills\nGo\n## Skills\nGo\n'));
  assert.ok(r.problems.some((p) => /non-standard section heading "## My Journey"/.test(p)));
  assert.ok(r.problems.some((p) => /missing section "## Experience"/.test(p)));
  assert.ok(r.problems.some((p) => /duplicate sections: skills/.test(p)));
  assert.ok(r.problems.some((p) => /no email/.test(p)));
});
test('checkRoles: heading shape, date range, one format, reverse order, end >= start', () => {
  assert.deepEqual(checkRoles(parseCv(GOOD)).problems, []);
  assert.equal(dateFormOf('Mar 2021 to Jun 2024'), 'Mon YYYY');
  assert.equal(dateFormOf('2021年3月 至今'), 'YYYY年MM月');
  const mixed = parseCv('# A\na@b.c\n## Experience\n### Acme — Dev\n2021-03 to 2022-01\n- a\n### Beta — Dev\nMar 2018 to Jan 2020\n- b\n');
  assert.ok(checkRoles(mixed).problems.some((p) => /mixed date formats/.test(p)));
  const order = parseCv('# A\na@b.c\n## Experience\n### Acme — Dev\n2018-03 to 2020-01\n- a\n### Beta — Dev\n2021-03 to 2022-01\n- b\n');
  assert.ok(checkRoles(order).problems.some((p) => /reverse-chronological/.test(p)));
  const noRange = parseCv('# A\na@b.c\n## Experience\n### Acme Dev\n2021-03\n- a\n### Beta — Dev\nTaipei\n- b\n### Gamma — Dev\n- c\n');
  const p = checkRoles(noRange).problems;
  assert.ok(p.some((x) => /should be "Company — Title"/.test(x)));
  assert.ok(p.some((x) => /needs a range/.test(x)));
  assert.ok(p.some((x) => /no recognisable date/.test(x)));
  assert.ok(p.some((x) => /no date line/.test(x)));
  const backwards = parseCv('# A\na@b.c\n## Experience\n### Acme — Dev\n2022-03 to 2021-01\n- a\n');
  assert.ok(checkRoles(backwards).problems.some((x) => /end date before start/.test(x)));
  const years = parseCv('# A\na@b.c\n## Experience\n### Acme — Dev\n2020 - 2022\n- a\n');
  assert.deepEqual(checkRoles(years).problems, []);
  assert.ok(checkRoles(years).notes.some((n) => /year-only/.test(n)));
});
test('checkLayout flags tables, images, html, emoji', () => {
  const r = checkLayout(parseCv('# A\n| a | b |\n![x](y)\n<table>\n✅ done\n'));
  assert.equal(r.problems.length, 4);
});
test('atsCheck: full cv passes; coverage gate and fixable keywords become problems; lexicon pass is notes only', () => {
  const rows = parseReview('| keyword | evidence | verdict |\n| --- | --- | --- |\n| Go | cv | supported |\n| Kubernetes | cv | supported |\n| Kafka | none | gap |\nverdict: pass').rows;
  const ok = atsCheck(GOOD, { keywords: rows, posting: 'Go, Kubernetes, Kafka, Datadog and GraphQL', coverageMin: 0.5 });
  assert.equal(ok.ok, true, ok.problems.join('; '));
  assert.equal(ok.coverage.hit.length, 2);
  assert.ok(ok.notes.some((n) => /keyword coverage 2\/3/.test(n)));
  assert.ok(ok.notes.some((n) => /posting also mentions.*datadog/.test(n)));
  assert.ok(!ok.lexicon.miss.includes('kubernetes'));
  const strict = atsCheck(GOOD, { keywords: rows, coverageMin: 0.9 });
  assert.ok(strict.problems.some((p) => /coverage 67% below 90%/.test(p)));
  const rows2 = parseReview('| keyword | evidence | verdict |\n| --- | --- | --- |\n| Rust | cv | supported |\nverdict: pass').rows;
  assert.ok(atsCheck(GOOD, { keywords: rows2, coverageMin: 0 }).problems.some((p) => /reviewer says supported but draft never mentions: Rust/.test(p)));
  const cover = atsCheck('# Lin Mei\n\nDear team,\n\nI like Go.\n', { kind: 'cover' });
  assert.equal(cover.ok, true);
});
test('atsFileName slugs name and title, CJK kept', () => {
  assert.equal(atsFileName('Lin Mei', 'Senior Backend Engineer (Go)', 'CV'), 'Lin-Mei-Senior-Backend-Engineer-CV.pdf');
  assert.equal(atsFileName('林美', '後端工程師', 'Cover-Letter', 'docx'), '林美-後端工程師-Cover-Letter.docx');
  assert.equal(atsFileName('', '', 'CV'), 'CV.pdf');
});
test('postingText and checkApplication read the application folder', () => {
  const body = '# X\n\n## Score\n\nn/a Kafka\n\n## Job description\n\nGo and Kubernetes\n\n## Requirements\n\nTerraform\n\n## Materials\n\n(S3)\n';
  assert.match(postingText(body), /Go and Kubernetes[\s\S]*Terraform/);
  assert.ok(!/Kafka/.test(postingText(body)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-ats-'));
  fs.writeFileSync(path.join(dir, 'cv.md'), GOOD);
  fs.writeFileSync(path.join(dir, 'review.md'), '| keyword | evidence | verdict |\n| --- | --- | --- |\n| Go | cv | supported |\nverdict: pass\n');
  const r = checkApplication(dir, { reportBody: body, thresholds: { keyword_coverage_min: 0.5 }, fs, path, parseReview });
  assert.deepEqual(r.problems, []);
  assert.equal(r.cv.coverage.hit.length, 1);
  const empty = checkApplication(fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-ats2-')), { fs, path, parseReview });
  assert.deepEqual(empty.problems, ['cv.md missing']);
});

// ---- docx ----
test('zip/unzip round-trip with deflate and CJK names', () => {
  const z = zip([{ name: 'a/b.txt', data: 'hello' }, { name: '中.xml', data: Buffer.from('<x/>') }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const m = unzip(z);
  assert.equal(m.get('a/b.txt').toString(), 'hello');
  assert.equal(m.get('中.xml').toString(), '<x/>');
});
test('runs: bold, italic, code, link text, xml escaping', () => {
  const r = runs('a **b** *c* `d` [e](http://x) & <f>');
  assert.match(r, /<w:b\/><\/w:rPr><w:t xml:space="preserve">b<\/w:t>/);
  assert.match(r, /<w:i\/><\/w:rPr><w:t xml:space="preserve">c<\/w:t>/);
  assert.match(r, /Consolas.*<w:t xml:space="preserve">d<\/w:t>/);
  assert.match(r, /<w:t xml:space="preserve">e<\/w:t>/);
  assert.doesNotMatch(r, /http:\/\/x/);
  assert.match(r, /&amp; &lt;f&gt;/);
});
test('markdownToDocx: valid package parts, styles mapped, text order preserved, metadata holds only title/author', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-docx-'));
  const md = path.join(dir, 'cv.md'); fs.writeFileSync(md, GOOD);
  const out = markdownToDocx(md, path.join(dir, 'cv.docx'), { author: 'Lin Mei' });
  const parts = unzip(fs.readFileSync(out));
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) assert.ok(parts.has(p), p);
  const doc = parts.get('word/document.xml').toString();
  assert.match(doc, /<w:pStyle w:val="Title"\/>.*Lin Mei/);
  assert.match(doc, /<w:pStyle w:val="Contact"\/>.*mei@example.com/);
  assert.match(doc, /<w:pStyle w:val="Heading1"\/>.*Experience/);
  assert.match(doc, /<w:pStyle w:val="Heading2"\/>.*Acme — Senior Backend Engineer/);
  assert.match(doc, /<w:pStyle w:val="Meta"\/>.*2021-03 to present/);
  assert.match(doc, /<w:numPr>.*Cut p99 latency/);
  assert.doesNotMatch(doc, /<w:tbl>/);
  const text = docxText(out);
  assert.ok(text.indexOf('Lin Mei') < text.indexOf('Summary') && text.indexOf('Summary') < text.indexOf('Acme'));
  assert.match(text, /\+886-912-345-678/);
  const core = parts.get('docProps/core.xml').toString();
  assert.match(core, /<dc:creator>Lin Mei<\/dc:creator>/);
  assert.doesNotMatch(core, /lastModifiedBy|dcterms/);
  assert.ok(markdownToDocxBuffer('# T\n\nx').length > 1000);
});
