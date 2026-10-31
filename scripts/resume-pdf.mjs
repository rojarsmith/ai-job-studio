#!/usr/bin/env node
// Render the master resume (source/cv.md and every source/cv.<lang>.md) to ATS-named PDFs, with the workspace's
// "do not publish" rules (source/redact.yml) applied first. For profile uploads on job sites; per-job resumes use build-pdf.
//   node scripts/resume-pdf.mjs [--out <dir>] [--title "<title for the file name>"] [--lang en,zh-TW] [--docx]
// Default out: <workspace>/generated/resumes. Names: <Name>-<Title>-CV.pdf, <Name>-<Title>-CV-<lang>.pdf for translations.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P, TIER } from '../lib/paths.mjs';
import { markdownToPdf, checkPdf } from '../lib/pdf.mjs';
import { markdownToDocx } from '../lib/docx.mjs';
import { atsFileName } from '../lib/ats.mjs';
import { loadRedact, applyRedact, findForbidden } from '../lib/redact.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const profile = loadConfig('profile');
const out = path.resolve(opt('--out') ?? path.join(TIER.generated, 'resumes'));
const title = opt('--title') ?? profile.target_titles?.[0] ?? '';
const only = opt('--lang')?.split(',');
const rules = loadRedact();

const src = path.dirname(P.cv);
const langs = [{ lang: 'en', file: P.cv, kind: 'CV' }, ...fs.readdirSync(src).map((f) => f.match(/^cv\.([A-Za-z-]+)\.md$/)).filter(Boolean)
  .map((m) => ({ lang: m[1], file: path.join(src, m[0]), kind: `CV-${m[1]}` }))].filter((l) => fs.existsSync(l.file) && (!only || only.includes(l.lang)));
if (!langs.length) { console.error('[resume-pdf] no source/cv.md found'); process.exit(1); }

fs.mkdirSync(out, { recursive: true });
let ok = true;
for (const l of langs) {
  const text = applyRedact(fs.readFileSync(l.file, 'utf8'), rules);
  const bad = findForbidden(text, rules);
  if (bad.length) { console.error(`[resume-pdf] ${path.basename(l.file)} still matches forbid rule(s) after redaction: ${bad.join(' | ')}`); ok = false; continue; }
  const md = path.join(out, `.${l.kind}.redacted.md`);
  fs.writeFileSync(md, text);
  const pdf = path.join(out, atsFileName(profile.name, title, l.kind, 'pdf'));
  await markdownToPdf(md, pdf, { cssName: 'resume.css', lang: l.lang });
  const r = checkPdf(pdf, { maxPages: 99, kind: 'cv', contact: { name: profile.name, email: profile.email, phone: profile.phone } });
  for (const p of r.problems) console.error(`[resume-pdf] PROBLEM ${path.basename(pdf)}: ${p}`);
  if (!r.ok) ok = false;
  if (args.includes('--docx')) markdownToDocx(md, pdf.replace(/\.pdf$/, '.docx'), { author: profile.name ?? '' });
  fs.rmSync(md, { force: true });
  fs.rmSync(pdf.replace(/\.pdf$/, '.html'), { force: true });
  console.log(`[resume-pdf] ${pdf} (${fs.statSync(pdf).size} bytes, ${r.pages ?? '?'} page(s))`);
}
process.exit(ok ? 0 : 1);
