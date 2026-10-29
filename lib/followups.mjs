// data/followups.md: one "## NNN · day D" section per follow-up. Status line: "status: draft | sent | skipped".
import fs from 'node:fs';
import { P } from './paths.mjs';
import { today } from './config.mjs';

const HEAD_RE = /^## (\d{3,}) · day (\d+)(?: · (.*))?$/;

export function parseFollowups(text) {
  const items = [];
  let cur = null;
  const preamble = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(HEAD_RE);
    if (m) { cur = { id: m[1], day: Number(m[2]), title: m[3] ?? '', status: 'draft', created: '', lines: [] }; items.push(cur); continue; }
    if (!cur) { preamble.push(line); continue; }
    const s = line.match(/^status:\s*(draft|sent|skipped)\s*(?:\((.*?)\))?$/i);
    if (s) { cur.status = s[1].toLowerCase(); cur.status_note = s[2] ?? ''; continue; }
    const c = line.match(/^created:\s*(\S+)/i);
    if (c) { cur.created = c[1]; continue; }
    cur.lines.push(line);
  }
  return { preamble: preamble.join('\n').replace(/\s+$/, ''), items };
}
export function formatFollowups({ preamble, items }) {
  return `${preamble}\n\n` + items.map((i) => `## ${i.id} · day ${i.day}${i.title ? ` · ${i.title}` : ''}\ncreated: ${i.created || today()}\nstatus: ${i.status}${i.status_note ? ` (${i.status_note})` : ''}\n${i.lines.join('\n').replace(/\s+$/, '')}\n`).join('\n');
}
export function readFollowups(file = P.data('followups.md')) {
  return parseFollowups(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Follow-ups\n');
}
export function writeFollowups(data, file = P.data('followups.md')) { fs.writeFileSync(file, formatFollowups(data)); }

/** Which (application, day) pairs are due: applied + day <= today, status still open, not yet present. */
export function dueFollowups(trackerRows, existing, days, now = today()) {
  const have = new Set(existing.map((i) => `${i.id}:${i.day}`));
  const due = [];
  for (const r of trackerRows) {
    if (!['submitted', 'screening'].includes(r.status)) continue;
    const applied = Date.parse(r.applied);
    if (!Number.isFinite(applied)) continue;
    for (const d of days) {
      const dueDate = new Date(applied + d * 86400000).toISOString().slice(0, 10);
      if (dueDate <= now && !have.has(`${r.id}:${d}`)) due.push({ id: r.id, day: d, dueDate, row: r });
    }
  }
  return due;
}
