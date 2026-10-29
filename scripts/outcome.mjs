#!/usr/bin/env node
// S8 Outcome. Event-driven status changes with the paperwork that goes with them.
//   node scripts/outcome.mjs <NNN> interview [note]   → status interview, creates applications/NNN/interview.md stub for modes/interview.md
//   node scripts/outcome.mjs <NNN> offer|rejected|ghosted [note]   → closes the row; rejected note is bucketed in the retro
//   node scripts/outcome.mjs <NNN> debrief           → appends a debrief stub to interview.md for modes/debrief.md
import fs from 'node:fs';
import path from 'node:path';
import { today } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readTracker, setStatus } from '../lib/tracker.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { canTransition } from '../lib/state.mjs';

const [id, event, ...rest] = process.argv.slice(2);
const note = rest.join(' ');
if (!id || !event) { console.error('usage: outcome.mjs <NNN> interview|offer|rejected|ghosted|debrief [note]'); process.exit(2); }
const tracker = readTracker();
const t = tracker.rows.find((r) => r.id === id);
if (!t) { console.error(`[outcome] tracker has no #${id}`); process.exit(1); }
const dir = path.join(P.applications, id);
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'interview.md');

if (event === 'debrief') {
  fs.appendFileSync(file, `\n## Debrief ${today()}\n\n${note ? `- note: ${note}\n` : ''}- went well:\n- went badly:\n- questions asked:\n- follow-up promised:\n- what to change in cv.md or the modes:\n\n(modes/debrief.md expands this from your bullet notes)\n`);
  console.log(`[outcome] debrief stub appended to applications/${id}/interview.md`);
  process.exit(0);
}
if (!['interview', 'offer', 'rejected', 'ghosted'].includes(event)) { console.error(`[outcome] unknown event ${event}`); process.exit(2); }

const pipeline = readPipeline();
const p = pipeline.rows.find((r) => r.report?.startsWith(`${id}-`));
if (p && p.state !== event) {
  if (!canTransition(p.state, event)) { console.error(`[outcome] pipeline ${p.state} → ${event} not allowed`); process.exit(1); }
  transition(p, event, note || `outcome ${event}`);
  writePipeline(pipeline);
}
setStatus(id, event, { note, next: event === 'interview' ? 'prepare with modes/interview.md' : '' });
if (event === 'interview' && !fs.existsSync(file)) {
  fs.writeFileSync(file, `# Interview — ${t.company} — ${t.title}\n\n- url: ${t.url}\n- status set: ${today()}${note ? `\n- note: ${note}` : ''}\n\n## Prep\n\n(modes/interview.md writes the question bank here from the report and cv.md)\n`);
  console.log(`[outcome] created applications/${id}/interview.md`);
}
console.log(`[outcome] #${id} → ${event}`);
