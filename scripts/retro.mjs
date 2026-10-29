#!/usr/bin/env node
// S9 Retro. Writes retro/YYYY-WW.md with the funnel per source, response by score band, rejection buckets, scans,
// session health and deterministic suggestions. modes/retro.md adds judgement and proposed config changes.
//   node scripts/retro.mjs [--week YYYY-WW] [--note "..."]...
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline } from '../lib/pipeline.mjs';
import { readTracker } from '../lib/tracker.mjs';
import { readTsv } from '../lib/tsv.mjs';
import { readSessions } from '../lib/sessions.mjs';
import { isoWeek, funnelBySource, responseByScore, rejectionReasons, suggestions, renderRetro } from '../lib/retro.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const notes = args.flatMap((a, i) => (a === '--note' && args[i + 1] ? [args[i + 1]] : []));
const week = opt('--week') ?? isoWeek();
const th = loadConfig('thresholds');
const { rows } = readPipeline();
const tracker = readTracker().rows;
const log = readTsv(P.data('status-log.tsv'));
const scansAll = readTsv(P.data('scan-history.tsv'));
const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const scans = scansAll.filter((s) => s.date >= since);
const sessions = readSessions();

const funnel = funnelBySource(rows, tracker);
const bands = responseByScore(rows, tracker);
const reasons = rejectionReasons(log);
const sug = suggestions({ funnel, bands, sessions, thresholds: th });
const md = renderRetro({ week, funnel, bands, reasons, scans, suggestions: sug, notes });
fs.mkdirSync(P.retro, { recursive: true });
const out = path.join(P.retro, `${week}.md`);
if (fs.existsSync(out) && !args.includes('--force')) {
  // keep the human's Decisions section, refresh the numbers above it
  const old = fs.readFileSync(out, 'utf8');
  const keep = old.slice(old.indexOf('## Decisions'));
  fs.writeFileSync(out, md.slice(0, md.indexOf('## Decisions')) + keep);
} else fs.writeFileSync(out, md);
console.log(`[retro] wrote ${out}`);
console.log(`[retro] sources=${Object.keys(funnel).length} applications=${tracker.length} suggestions=${sug.length}`);
for (const s of sug) console.log(`  - ${s}`);
