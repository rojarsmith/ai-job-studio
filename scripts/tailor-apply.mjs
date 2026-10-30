#!/usr/bin/env node
// S3 human gate. Shows the reviewer summary and PDF check results for one application; with --ok records
// the materials in the report and moves the pipeline row scored → tailored. Without --ok nothing changes.
//   node scripts/tailor-apply.mjs <NNN>          review
//   node scripts/tailor-apply.mjs <NNN> --ok     approve
//   node scripts/tailor-apply.mjs --list         applications waiting for approval
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, today } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { readReport, writeReport } from '../lib/report.mjs';
import { checkPdf } from '../lib/pdf.mjs';
import { parseReview, setMaterials, listApplications } from '../lib/tailor.mjs';
import { checkApplication } from '../lib/ats.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => /^\d{3,}$/.test(a));
const pipeline = readPipeline();
const rowFor = (nnn) => pipeline.rows.find((r) => r.report?.startsWith(`${nnn}-`));

if (args.includes('--list')) {
  for (const nnn of listApplications(P.applications)) {
    const row = rowFor(nnn);
    const dir = path.join(P.applications, nnn);
    const have = ['cv.md', 'cover.md', 'review.md', 'cv.pdf', 'cover.pdf', 'cv.docx', 'answers.md'].filter((f) => fs.existsSync(path.join(dir, f)));
    console.log(`${nnn}  ${row?.state ?? '?'}  ${row?.company ?? ''} — ${row?.title ?? ''}  [${have.join(' ')}]`);
  }
  process.exit(0);
}
if (!id) { console.error('usage: node scripts/tailor-apply.mjs <NNN> [--ok] | --list'); process.exit(2); }

const row = rowFor(id);
if (!row) { console.error(`[tailor-apply] no pipeline row with report ${id}-*`); process.exit(1); }
const dir = path.join(P.applications, id);
const th = loadConfig('thresholds').tailor ?? {};
const profile = loadConfig('profile');
const problems = [];

const reviewFile = path.join(dir, 'review.md');
let review = { rows: [], verdict: null, gaps: [] };
if (!fs.existsSync(reviewFile)) problems.push('review.md missing (reviewer pass not run)');
else {
  review = parseReview(fs.readFileSync(reviewFile, 'utf8'));
  if (review.verdict !== 'pass') problems.push(`review verdict is ${review.verdict ?? 'missing'} (needs "verdict: pass")`);
  if (review.rows.length === 0) problems.push('review.md has no keyword table');
}
const checks = {};
for (const [f, max, kind] of [['cv.pdf', th.cv_max_pages ?? 2, 'cv'], ['cover.pdf', th.cover_max_pages ?? 1, 'cover']]) {
  const r = checkPdf(path.join(dir, f), { maxPages: max, kind, contact: { name: profile.name, email: profile.email, phone: profile.phone } });
  checks[f] = r;
  problems.push(...r.problems);
}
if (!fs.existsSync(P.answers)) problems.push('source/answers.md missing (run tailor-prep)');
const rep = readReport(row.report);
const ats = checkApplication(dir, { reportBody: rep.body, thresholds: th, fs, path, parseReview });
problems.push(...ats.problems);
const named = fs.existsSync(path.join(dir, 'files.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'files.json'), 'utf8')) : {};
if (!named['cv.pdf']) problems.push('no ATS-named copy (run build-pdf)');

console.log(`[tailor-apply] ${id}  ${row.company} — ${row.title}  state=${row.state}`);
console.log(`[tailor-apply] review: ${review.rows.length} keywords, ${review.rows.filter((r) => r.verdict === 'supported').length} supported, ${review.gaps.length} gaps, ${review.rows.filter((r) => r.verdict === 'removed').length} removed; verdict=${review.verdict}`);
if (review.gaps.length) console.log(`[tailor-apply] gaps: ${review.gaps.join(', ')}`);
for (const [f, r] of Object.entries(checks)) for (const n of r.notes) console.log(`[tailor-apply] ${n}`);
for (const n of ats.notes) console.log(`[tailor-apply] ${n}`);
if (named['cv.pdf']) console.log(`[tailor-apply] upload as: ${Object.values(named).join(', ')}`);
for (const p of problems) console.error(`[tailor-apply] PROBLEM ${p}`);

if (!args.includes('--ok')) {
  console.log(problems.length ? '[tailor-apply] fix the problems above, then re-run with --ok' : '[tailor-apply] read review.md and the PDFs; approve with --ok');
  process.exit(problems.length ? 1 : 0);
}
if (problems.length) { console.error('[tailor-apply] refusing to approve with open problems'); process.exit(1); }
if (row.state !== 'scored') { console.error(`[tailor-apply] row is ${row.state}, expected scored`); process.exit(1); }

rep.body = setMaterials(rep.body, `- approved: ${today()}
- folder: applications/${id}/
- cv.pdf: ${checks['cv.pdf'].pages} page(s)
- cover.pdf: ${checks['cover.pdf'].pages} page(s)
- keywords: ${review.rows.length} (${review.gaps.length} gaps: ${review.gaps.join(', ') || 'none'})
- keyword coverage: ${ats.cv ? `${ats.cv.coverage.hit.length}/${ats.cv.coverage.total}` : 'n/a'}
- files: ${Object.values(named).join(', ') || 'cv.pdf, cover.pdf'}`);
rep.front.tailored_at = today();
writeReport(row.report, rep);
transition(row, 'tailored', `human ok; gaps=${review.gaps.length}; coverage=${ats.cv ? Math.round(ats.cv.coverage.ratio * 100) : 'na'}%`);
writePipeline(pipeline);
console.log(`[tailor-apply] ${id} → tailored`);
