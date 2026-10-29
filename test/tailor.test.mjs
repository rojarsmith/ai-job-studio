import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { answersSkeleton, parseReview, setMaterials, listApplications } from '../lib/tailor.mjs';
import { renderHtml, pageCount } from '../lib/pdf.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-t-'));

test('answers skeleton carries profile facts and marks sensitive lines', () => {
  const s = answersSkeleton({ name: 'A B', email: 'a@b.c', phone: '+1', work_authorization: { other: 'needs_sponsorship' }, salary: { currency: 'TWD', monthly_min: 100000 } }, { company: 'Acme', title: 'Dev' });
  assert.match(s, /full_name: A B/);
  assert.match(s, /requires_sponsorship: yes/);
  assert.match(s, /salary_expectation: TWD 100000\/month minimum\s+# needs_confirmation/);
  assert.match(s, /^# Answers — Acme — Dev/);
});
test('parseReview reads keyword table and verdict', () => {
  const r = parseReview(`# Review
| keyword | evidence | verdict |
| --- | --- | --- |
| Go | cv.md: "Go service" | supported |
| Kafka | none; removed | removed |
| CKA | none | gap |

verdict: pass
`);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.gaps, ['CKA']);
  assert.equal(r.verdict, 'pass');
  assert.equal(parseReview('no table').verdict, null);
});
test('setMaterials replaces or appends the section', () => {
  const b1 = setMaterials('# T\n\n## Score\n\nx\n\n## Materials\n\n(S3)\n', '- a: 1');
  assert.match(b1, /## Materials\n\n- a: 1\n$/);
  assert.doesNotMatch(b1, /\(S3\)/);
  const b2 = setMaterials('# T\n\n## Score\n\nx\n', '- a: 1');
  assert.match(b2, /x\n\n## Materials\n\n- a: 1\n$/);
  const b3 = setMaterials('# T\n\n## Materials\n\nold\n\n## Gaps\n\ng\n', '- new');
  assert.match(b3, /## Materials\n\n- new\n## Gaps\n\ng\n/);
});
test('listApplications only numeric dirs', () => {
  fs.mkdirSync(path.join(tmp, '002')); fs.mkdirSync(path.join(tmp, '001')); fs.mkdirSync(path.join(tmp, 'x')); fs.writeFileSync(path.join(tmp, '003'), '');
  assert.deepEqual(listApplications(tmp), ['001', '002']);
});
test('renderHtml escapes title and renders markdown', () => {
  const h = renderHtml('# Jane & Doe\n\nmail · tel\n\n## Skills\n\n- Go\n', { css: 'b{}', title: 'x<y' });
  assert.match(h, /<title>x&lt;y<\/title>/);
  assert.match(h, /<h1>Jane &amp; Doe<\/h1>/);
  assert.match(h, /<li>Go<\/li>/);
});
test('pageCount from text layer and from PDF bytes', () => {
  assert.equal(pageCount('x', 'page1\fpage2\f'), 2);
  assert.equal(pageCount('x', 'only\f'), 1);
  const f = path.join(tmp, 'a.pdf');
  fs.writeFileSync(f, '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >> endobj\n');
  assert.equal(pageCount(f), 2);
});
