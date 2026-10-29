#!/usr/bin/env node
// Pipeline overview: rows per state and per source, reports waiting for a score.
import { readPipeline } from '../lib/pipeline.mjs';
import { listReports, readReport } from '../lib/report.mjs';
import { STATES } from '../lib/state.mjs';

import { WORKSPACE } from '../lib/paths.mjs';

console.log(`workspace: ${WORKSPACE.dir} (via ${WORKSPACE.via})`);
const { rows } = readPipeline();
const count = (key) => rows.reduce((m, r) => (m[r[key] || '-'] = (m[r[key] || '-'] ?? 0) + 1, m), {});
const byState = count('state'), bySource = count('source');
console.log(`pipeline rows: ${rows.length}`);
console.log('by state : ' + STATES.filter((s) => byState[s]).map((s) => `${s}=${byState[s]}`).join('  '));
console.log('by source: ' + Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join('  '));
const unscored = listReports().filter((f) => readReport(f).front.score == null);
console.log(`reports waiting for score: ${unscored.length}${unscored.length ? '\n  ' + unscored.join('\n  ') : ''}`);
const ready = rows.filter((r) => r.state === 'scored');
if (ready.length) console.log('ready for S3 tailor (node scripts/tailor-prep.mjs):\n  ' + ready.map((r) => `[${r.score}] ${r.company} — ${r.title}  ${r.report}`).join('\n  '));
const tailored = rows.filter((r) => r.state === 'tailored');
if (tailored.length) console.log('tailored, waiting for S4 prepare (node scripts/prepare.mjs <site>):\n  ' + tailored.map((r) => `[${r.score}] ${r.source}  ${r.company} — ${r.title}  applications/${r.report.slice(0, 3)}/`).join('\n  '));
const prepared = rows.filter((r) => ['prepared', 'filled'].includes(r.state));
if (prepared.length) console.log('ready for S5 apply (node scripts/apply.mjs NNN):\n  ' + prepared.map((r) => `${r.report.slice(0, 3)}  ${r.state}  ${r.source}  ${r.company} — ${r.title}`).join('\n  '));
const human = rows.filter((r) => r.state === 'needs_human');
if (human.length) console.log('needs_human:\n  ' + human.map((r) => `${r.report?.slice(0, 3) ?? '-'}  ${r.source}  ${r.company} — ${r.title}`).join('\n  '));
const { readSessions } = await import('../lib/sessions.mjs');
const sessions = readSessions();
if (sessions.length) console.log('sessions: ' + sessions.map((s) => `${s.site}(verified ${s.last_verified || '-'}${s.locked ? ', LOCKED ' + s.locked.slice(0, 10) : ''})`).join('  '));
