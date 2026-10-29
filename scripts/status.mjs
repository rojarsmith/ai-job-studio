#!/usr/bin/env node
// Pipeline overview: rows per state and per source, reports waiting for a score.
import { readPipeline } from '../lib/pipeline.mjs';
import { listReports, readReport } from '../lib/report.mjs';
import { STATES } from '../lib/state.mjs';

const { rows } = readPipeline();
const count = (key) => rows.reduce((m, r) => (m[r[key] || '-'] = (m[r[key] || '-'] ?? 0) + 1, m), {});
const byState = count('state'), bySource = count('source');
console.log(`pipeline rows: ${rows.length}`);
console.log('by state : ' + STATES.filter((s) => byState[s]).map((s) => `${s}=${byState[s]}`).join('  '));
console.log('by source: ' + Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join('  '));
const unscored = listReports().filter((f) => readReport(f).front.score == null);
console.log(`reports waiting for score: ${unscored.length}${unscored.length ? '\n  ' + unscored.join('\n  ') : ''}`);
const ready = rows.filter((r) => r.state === 'scored');
if (ready.length) console.log('ready for S3 tailor:\n  ' + ready.map((r) => `[${r.score}] ${r.company} — ${r.title}  ${r.report}`).join('\n  '));
