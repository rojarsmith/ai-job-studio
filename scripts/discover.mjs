#!/usr/bin/env node
// S1 Discover. Login-free search across config/portals.yml, dedup, blacklist, append to data/pipeline.md.
//   node scripts/discover.mjs [--source greenhouse|104] [--dry-run] [--recheck] [--recheck-all]
// --recheck: liveness-check open rows older than thresholds.liveness_recheck_days; closed rows → skip.
import { loadConfig, today } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { isDuplicate } from '../lib/dedup.mjs';
import { blacklistReason } from '../lib/blacklist.mjs';
import { appendTsv } from '../lib/tsv.mjs';
import { adapterFor, adapterForUrl } from '../adapters/index.mjs';
import { OPEN_PRE_APPLY } from '../lib/state.mjs';
import { politeDelay } from '../lib/http.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k) => args.includes(k);
const dry = flag('--dry-run');
const only = opt('--source');

const portals = loadConfig('portals');
const thresholds = loadConfig('thresholds');
const pipeline = readPipeline();
const date = today();
const summary = { found: 0, new: 0, dup: 0, blacklisted: 0, closed: 0, errors: 0 };

for (const [source, cfg] of Object.entries(portals.sources ?? {})) {
  if (cfg?.enabled === false || (only && only !== source)) continue;
  const t0 = Date.now();
  let jobs = [];
  try { jobs = await adapterFor(source).search(cfg); }
  catch (e) { summary.errors++; console.error(`[discover] ${source} failed: ${e.message}`); continue; }
  let added = 0;
  for (const job of jobs) {
    summary.found++;
    const bl = blacklistReason(job);
    if (bl) { summary.blacklisted++; continue; }
    const dup = isDuplicate(job, pipeline.rows);
    if (dup) { summary.dup++; continue; }
    pipeline.rows.push({ url: job.url, company: job.company, title: job.title, source, found: date, state: 'discovered', score: '', report: '' });
    added++;
    console.log(`[discover] + ${source} | ${job.company} | ${job.title} | ${job.url}`);
  }
  summary.new += added;
  const query = source === 'greenhouse' ? `boards=${(cfg.boards ?? []).join(',')} kw=${(cfg.keywords ?? []).join('/')}` : `kw=${(cfg.keywords ?? []).join('/')} areas=${(cfg.areas ?? []).join(',')}`;
  if (!dry) appendTsv(P.data('scan-history.tsv'), ['date', 'source', 'query', 'found', 'new', 'duration_ms'], { date, source, query, found: jobs.length, new: added, duration_ms: Date.now() - t0 });
  console.log(`[discover] ${source}: found=${jobs.length} new=${added} (${Date.now() - t0} ms)`);
}

if (flag('--recheck') || flag('--recheck-all')) {
  const days = thresholds.liveness_recheck_days ?? 7;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const targets = pipeline.rows.filter((r) => OPEN_PRE_APPLY.includes(r.state) && (flag('--recheck-all') || r.found <= cutoff));
  console.log(`[liveness] checking ${targets.length} open rows`);
  for (const r of targets) {
    const a = adapterForUrl(r.url);
    if (!a) continue;
    try {
      if (!(await a.isLive(r.url))) { transition(r, 'skip', 'closed'); summary.closed++; console.log(`[liveness] closed → skip: ${r.url}`); }
    } catch (e) { summary.errors++; console.error(`[liveness] ${r.url}: ${e.message}`); }
    await politeDelay();
  }
}

if (dry) console.log('[discover] dry-run, pipeline not written');
else writePipeline(pipeline);
console.log(`[discover] done ${JSON.stringify(summary)} pipeline_rows=${pipeline.rows.length}`);
