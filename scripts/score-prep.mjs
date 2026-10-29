#!/usr/bin/env node
// S2 step 1 (no LLM). For every pipeline row in state "discovered" without a report:
//   fetch the full job text → write reports/NNN-company-title.md → link it in the row.
//   Closed jobs → skip. Deal-breaker hits (config/profile.yml) → score 1 / action skip immediately, no LLM needed.
//   node scripts/score-prep.mjs [--limit N]
import { loadConfig, today, nowIso } from '../lib/config.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { adapterForUrl } from '../adapters/index.mjs';
import { buildReport, nextId, slug, writeReport } from '../lib/report.mjs';
import { politeDelay } from '../lib/http.mjs';
import { dealBreakerHit } from '../lib/scoring.mjs';

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const profile = loadConfig('profile');
const pipeline = readPipeline();
const targets = pipeline.rows.filter((r) => r.state === 'discovered' && !r.report).slice(0, limit);
console.log(`[score-prep] ${targets.length} rows to fetch`);
let n = 0, closed = 0, db = 0, errors = 0;

for (const row of targets) {
  const a = adapterForUrl(row.url);
  if (!a) { console.error(`[score-prep] no adapter for ${row.url}`); continue; }
  let job;
  try { job = await a.detail(row.url); }
  catch (e) { errors++; console.error(`[score-prep] ${row.url}: ${e.message}`); await politeDelay(); continue; }
  if (!job) { transition(row, 'skip', 'closed'); closed++; console.log(`[score-prep] closed → skip ${row.url}`); continue; }
  const id = nextId();
  const file = `${id}-${slug(job.company, 24)}-${slug(job.title, 40)}.md`;
  const report = buildReport(id, job, { found: row.found || today() });
  const hit = dealBreakerHit(`${job.title}\n${job.description}\n${job.requirements ?? ''}`, profile.deal_breakers ?? []);
  if (hit) {
    report.front.deal_breaker = hit; report.front.score = 1; report.front.action = 'skip';
    report.front.scored_at = nowIso(); report.front.scored_by = 'deal-breaker';
    db++;
  }
  writeReport(file, report);
  row.report = file;
  if (job.company && !row.company) row.company = job.company;
  n++;
  console.log(`[score-prep] wrote ${file}${hit ? ` (deal-breaker: ${hit})` : ''}`);
  await politeDelay();
}
writePipeline(pipeline);
console.log(`[score-prep] done reports=${n} closed=${closed} deal_breaker=${db} errors=${errors}`);
