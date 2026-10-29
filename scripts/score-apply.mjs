#!/usr/bin/env node
// S2 step 2 (no LLM). Read scores the scorer wrote into report frontmatter, validate, enforce thresholds,
// and move pipeline rows discovered → scored (apply/maybe) or → skip.
//   node scripts/score-apply.mjs
import { loadConfig, nowIso } from '../lib/config.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { listReports, readReport, writeReport } from '../lib/report.mjs';
import { decideAction, validateFront } from '../lib/scoring.mjs';

const th = loadConfig('thresholds');

const pipeline = readPipeline();
const byReport = new Map(pipeline.rows.map((r) => [r.report, r]));
let applied = 0, skipped = 0, pending = 0, invalid = 0;

for (const file of listReports()) {
  const row = byReport.get(file);
  if (!row || row.state !== 'discovered') continue;
  const rep = readReport(file);
  const f = rep.front;
  if (f.score === null || f.score === undefined) { pending++; continue; }
  const problems = validateFront(f);
  if (problems.length) { invalid++; console.error(`[score-apply] ${file}: ${problems.join('; ')}`); continue; }
  const action = f.deal_breaker ? 'skip' : decideAction(f.score, th);
  if (f.action !== action) console.log(`[score-apply] ${file}: scorer said ${f.action ?? 'null'}, thresholds say ${action}`);
  f.action = action;
  f.scored_at ||= nowIso();
  f.scored_by ||= 'llm';
  writeReport(file, rep);
  row.score = String(f.score);
  transition(row, 'scored', `score=${f.score} action=${action}`);
  if (action === 'skip') { transition(row, 'skip', f.deal_breaker ? `deal-breaker:${f.deal_breaker}` : `score=${f.score}<maybe_min`); skipped++; }
  else applied++;
  console.log(`[score-apply] ${file}: score=${f.score} → ${row.state} (${action})`);
}
writePipeline(pipeline);
console.log(`[score-apply] done scored=${applied} skipped=${skipped} pending=${pending} invalid=${invalid}`);
