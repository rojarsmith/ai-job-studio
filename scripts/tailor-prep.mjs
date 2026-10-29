#!/usr/bin/env node
// S3 step 1 (no LLM). For every pipeline row in state "scored" (action apply / maybe) create
// <workspace>/generated/applications/NNN/ with a per-job answers.md override and a brief, and make sure the shared
// <workspace>/source/answers.md exists (created once from profile.yml, never overwritten). NNN = the report id.
//   node scripts/tailor-prep.mjs [--limit N] [--id NNN]
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline } from '../lib/pipeline.mjs';
import { readReport } from '../lib/report.mjs';
import { answersSkeleton, answersOverrideSkeleton } from '../lib/tailor.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const limit = Number(opt('--limit')) || Infinity;
const onlyId = opt('--id');
const profile = loadConfig('profile');
const { rows } = readPipeline();
if (!fs.existsSync(P.answers)) { fs.writeFileSync(P.answers, answersSkeleton(profile)); console.log(`[tailor-prep] created ${P.answers} from profile.yml; review it once`); }

let created = 0, existing = 0;
const targets = rows.filter((r) => r.state === 'scored' && r.report).slice(0, limit);
for (const row of targets) {
  const id = row.report.slice(0, 3);
  if (onlyId && onlyId !== id) continue;
  const { front } = readReport(row.report);
  if (!['apply', 'maybe'].includes(front.action)) continue;
  const dir = path.join(P.applications, id);
  const isNew = !fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  const answers = path.join(dir, 'answers.md');
  if (!fs.existsSync(answers)) fs.writeFileSync(answers, answersOverrideSkeleton(front));
  const brief = path.join(dir, 'brief.md');
  if (!fs.existsSync(brief)) fs.writeFileSync(brief, `# ${front.company} — ${front.title}

- report: generated/reports/${row.report}
- url: ${front.url}
- score: ${front.score} (${front.action})
- state: ${row.state}

Produce in this folder (see modes/tailor.md): cv.md, cover.md, review.md. Then: node scripts/build-pdf.mjs ${id}
`);
  isNew ? created++ : existing++;
  console.log(`[tailor-prep] ${isNew ? 'new' : 'ok '} applications/${id}  ${front.company} — ${front.title} [${front.score} ${front.action}]`);
}
console.log(`[tailor-prep] done new=${created} existing=${existing} (targets=${targets.length})`);
