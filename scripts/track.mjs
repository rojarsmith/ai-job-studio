#!/usr/bin/env node
// S6 Track. Status overview of submitted applications; manual status changes; ghosting sweep.
//   node scripts/track.mjs                              counts by status + open rows
//   node scripts/track.mjs --set <NNN> <status> [note]  screening | interview | offer | rejected | ghosted
//   node scripts/track.mjs --mark-ghosted               submitted/screening rows untouched for thresholds.ghost_days → ghosted
// Inbox / site-message scanning is intentionally not automated (needs login state); update by hand or via outcome.mjs.
import { loadConfig, today } from '../lib/config.mjs';
import { readTracker, setStatus } from '../lib/tracker.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { canTransition } from '../lib/state.mjs';

const args = process.argv.slice(2);
const th = loadConfig('thresholds');
const tracker = readTracker();
const pipeline = readPipeline();
const rowFor = (id) => pipeline.rows.find((r) => r.report?.startsWith(`${id}-`));

export function applyStatus(id, status, note = '') {
  const t = tracker.rows.find((r) => r.id === id);
  if (!t) throw new Error(`tracker has no #${id}`);
  const p = rowFor(id);
  if (p && p.state !== status) {
    if (!canTransition(p.state, status)) throw new Error(`pipeline ${p.state} → ${status} is not allowed`);
    transition(p, status, note || 'track');
  }
  setStatus(id, status, { note, next: status === 'interview' ? 'prepare with modes/interview.md' : status === 'screening' ? 'await next step' : '' });
}

if (args[0] === '--set') {
  const [, id, status, ...rest] = args;
  if (!id || !status) { console.error('usage: track.mjs --set <NNN> <status> [note]'); process.exit(2); }
  applyStatus(id, status, rest.join(' '));
  writePipeline(pipeline);
  console.log(`[track] #${id} → ${status}`);
} else if (args[0] === '--mark-ghosted') {
  const days = th.ghost_days ?? 30, cutoff = Date.now() - days * 86400000;
  let n = 0;
  for (const t of tracker.rows) {
    if (!['submitted', 'screening'].includes(t.status)) continue;
    if (Date.parse(t.updated || t.applied) > cutoff) continue;
    applyStatus(t.id, 'ghosted', `no update for ${days}d`); n++;
    console.log(`[track] #${t.id} ${t.company} — ${t.title} → ghosted`);
  }
  writePipeline(pipeline);
  console.log(`[track] marked ${n} ghosted`);
} else {
  const counts = tracker.rows.reduce((m, r) => (m[r.status] = (m[r.status] ?? 0) + 1, m), {});
  console.log(`[track] ${today()} applications=${tracker.rows.length} ` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
  const open = tracker.rows.filter((r) => ['submitted', 'screening', 'interview'].includes(r.status));
  for (const r of open) console.log(`  #${r.id}  ${r.status.padEnd(10)} ${r.company} — ${r.title}  applied ${r.applied}  updated ${r.updated}${r.next ? `  next: ${r.next}` : ''}`);
}
