#!/usr/bin/env node
// S3 step 3 (no LLM). Compile applications/NNN/cv.md and cover.md to PDF with Chrome, then run the automatic gate.
//   node scripts/build-pdf.mjs <NNN> [--no-check] [--lang zh-TW]
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { markdownToPdf, checkPdf } from '../lib/pdf.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => /^\d{3,}$/.test(a));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
if (!id) { console.error('usage: node scripts/build-pdf.mjs <NNN> [--no-check] [--lang xx]'); process.exit(2); }

const dir = path.join(P.applications, id);
const th = loadConfig('thresholds').tailor ?? {};
const profile = loadConfig('profile');
const lang = opt('--lang') ?? profile.languages?.[0] ?? 'en';
const docs = [
  { md: 'cv.md', pdf: 'cv.pdf', css: 'resume.css', max: th.cv_max_pages ?? 2, kind: 'cv' },
  { md: 'cover.md', pdf: 'cover.pdf', css: 'cover.css', max: th.cover_max_pages ?? 1, kind: 'cover' },
];
let allOk = true;
for (const d of docs) {
  const src = path.join(dir, d.md);
  if (!fs.existsSync(src)) { console.log(`[build-pdf] ${id}/${d.md} missing, skipped`); if (d.kind === 'cv') allOk = false; continue; }
  const out = path.join(dir, d.pdf);
  await markdownToPdf(src, out, { cssName: d.css, lang });
  console.log(`[build-pdf] wrote ${id}/${d.pdf}`);
  if (args.includes('--no-check')) continue;
  const r = checkPdf(out, { maxPages: d.max, kind: d.kind, contact: { name: profile.name, email: profile.email, phone: profile.phone } });
  for (const n of r.notes) console.log(`[build-pdf] ${n}`);
  for (const p of r.problems) console.error(`[build-pdf] PROBLEM ${p}`);
  if (!r.ok) allOk = false;
}
console.log(allOk ? `[build-pdf] ${id} OK` : `[build-pdf] ${id} NOT OK`);
process.exit(allOk ? 0 : 1);
