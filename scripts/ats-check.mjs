#!/usr/bin/env node
// S3 ATS gate without Chrome. Checks applications/NNN/cv.md (and cover.md) the way an applicant tracking system
// parses them: standard section names, "Company — Title" roles with one date format in reverse order, no tables /
// images / columns, and keyword coverage against review.md (reviewer table) plus the posting text in the report.
//   node scripts/ats-check.mjs <NNN> [--json]
//   node scripts/ats-check.mjs --all
//   node scripts/ats-check.mjs --file <markdown>     structure checks only (no posting, no keyword table); use on source/cv.md
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline } from '../lib/pipeline.mjs';
import { readReport } from '../lib/report.mjs';
import { parseReview, listApplications } from '../lib/tailor.mjs';
import { checkApplication, atsFileName, atsCheck } from '../lib/ats.mjs';

const args = process.argv.slice(2);
const fileArg = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null;
if (fileArg) {
  const r = atsCheck(fs.readFileSync(fileArg, 'utf8'), { kind: 'cv' });
  for (const n of r.notes) console.log(`[ats-check] ${n}`);
  for (const p of r.problems) console.error(`[ats-check] PROBLEM ${p}`);
  console.log(`[ats-check] ${fileArg}: ${r.cv.sections.length} sections, ${r.cv.sections.flatMap((s) => s.roles).length} roles; ${r.ok ? 'OK' : `NOT OK (${r.problems.length} problems)`}`);
  process.exit(r.ok ? 0 : 1);
}
const ids = args.includes('--all') ? listApplications(P.applications) : args.filter((a) => /^\d{3,}$/.test(a));
if (!ids.length) { console.error('usage: node scripts/ats-check.mjs <NNN> [--json] | --all | --file <markdown>'); process.exit(2); }
const th = loadConfig('thresholds').tailor ?? {};
const profile = loadConfig('profile');
const { rows } = readPipeline();
let allOk = true;
for (const id of ids) {
  const row = rows.find((r) => r.report?.startsWith(`${id}-`));
  const body = row ? readReport(row.report).body : '';
  const r = checkApplication(path.join(P.applications, id), { reportBody: body, thresholds: th, fs, path, parseReview });
  if (args.includes('--json')) {
    console.log(JSON.stringify({ id, ok: !r.problems.length, problems: r.problems, notes: r.notes, coverage: r.cv?.coverage ?? null, lexicon: r.cv?.lexicon ?? null }, null, 2));
  } else {
    console.log(`[ats-check] ${id}  ${row?.company ?? ''} — ${row?.title ?? ''}  file: ${atsFileName(profile.name, row?.title ?? '', 'CV')}`);
    for (const n of r.notes) console.log(`[ats-check] ${n}`);
    for (const p of r.problems) console.error(`[ats-check] PROBLEM ${p}`);
    console.log(r.problems.length ? `[ats-check] ${id} NOT OK (${r.problems.length} problems)` : `[ats-check] ${id} OK`);
  }
  if (r.problems.length) allOk = false;
}
process.exit(allOk ? 0 : 1);
