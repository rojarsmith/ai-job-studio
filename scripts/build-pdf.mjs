#!/usr/bin/env node
// S3 step 3 (no LLM). Run the ATS text checks on applications/NNN/cv.md and cover.md, compile them to PDF with Chrome
// (and DOCX without Chrome), run the PDF gate, then write ATS-named copies "<Name>-<Title>-CV.pdf" next to cv.pdf.
//   node scripts/build-pdf.mjs <NNN> [--no-check] [--lang zh-TW] [--no-docx]
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline } from '../lib/pipeline.mjs';
import { readReport } from '../lib/report.mjs';
import { parseReview } from '../lib/tailor.mjs';
import { markdownToPdf, checkPdf } from '../lib/pdf.mjs';
import { markdownToDocx } from '../lib/docx.mjs';
import { checkApplication, atsFileName } from '../lib/ats.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => /^\d{3,}$/.test(a));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
if (!id) { console.error('usage: node scripts/build-pdf.mjs <NNN> [--no-check] [--lang xx] [--no-docx]'); process.exit(2); }

const dir = path.join(P.applications, id);
const th = loadConfig('thresholds').tailor ?? {};
const profile = loadConfig('profile');
const lang = opt('--lang') ?? profile.languages?.[0] ?? 'en';
const row = readPipeline().rows.find((r) => r.report?.startsWith(`${id}-`));
const title = row?.title ?? '';
const check = !args.includes('--no-check');
const wantDocx = !args.includes('--no-docx') && (th.docx ?? true);
let allOk = true;

// 1. text-level ATS checks (sections, dates, layout, keyword coverage) before spending a Chrome launch
if (check) {
  const r = checkApplication(dir, { reportBody: row ? readReport(row.report).body : '', thresholds: th, fs, path, parseReview });
  for (const n of r.notes) console.log(`[build-pdf] ${n}`);
  for (const p of r.problems) console.error(`[build-pdf] PROBLEM ${p}`);
  if (r.problems.length) allOk = false;
}

// 2. render, PDF gate, DOCX, ATS-named copies
const docs = [
  { md: 'cv.md', pdf: 'cv.pdf', docx: 'cv.docx', css: 'resume.css', max: th.cv_max_pages ?? 2, kind: 'cv', label: 'CV' },
  { md: 'cover.md', pdf: 'cover.pdf', docx: 'cover.docx', css: 'cover.css', max: th.cover_max_pages ?? 1, kind: 'cover', label: 'Cover-Letter' },
];
const named = {};
for (const d of docs) {
  const src = path.join(dir, d.md);
  if (!fs.existsSync(src)) { console.log(`[build-pdf] ${id}/${d.md} missing, skipped`); if (d.kind === 'cv') allOk = false; continue; }
  const out = path.join(dir, d.pdf);
  await markdownToPdf(src, out, { cssName: d.css, lang });
  console.log(`[build-pdf] wrote ${id}/${d.pdf}`);
  if (wantDocx) { markdownToDocx(src, path.join(dir, d.docx), { author: profile.name ?? '' }); console.log(`[build-pdf] wrote ${id}/${d.docx}`); }
  if (check) {
    const r = checkPdf(out, { maxPages: d.max, kind: d.kind, contact: { name: profile.name, email: profile.email, phone: profile.phone } });
    for (const n of r.notes) console.log(`[build-pdf] ${n}`);
    for (const p of r.problems) console.error(`[build-pdf] PROBLEM ${p}`);
    if (!r.ok) allOk = false;
  }
  // The upload keeps this file name and the ATS indexes it: "<Name>-<Title>-CV.pdf" beats "cv.pdf".
  for (const ext of ['pdf', ...(wantDocx ? ['docx'] : [])]) {
    const name = atsFileName(profile.name, title, d.label, ext);
    fs.copyFileSync(path.join(dir, ext === 'pdf' ? d.pdf : d.docx), path.join(dir, name));
    named[`${d.kind}.${ext}`] = name;
  }
}
if (Object.keys(named).length) { fs.writeFileSync(path.join(dir, 'files.json'), JSON.stringify(named, null, 2) + '\n'); console.log(`[build-pdf] named: ${Object.values(named).join(', ')}`); }
console.log(allOk ? `[build-pdf] ${id} OK` : `[build-pdf] ${id} NOT OK`);
process.exit(allOk ? 0 : 1);
