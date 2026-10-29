#!/usr/bin/env node
// S7 Follow-up. Creates draft stubs in data/followups.md for applications with no response at thresholds.followup_days.
// modes/followup.md writes the text; you decide whether to send.
//   node scripts/followup.mjs                 create due stubs, list drafts
//   node scripts/followup.mjs --sent <NNN> <day> [note]      mark sent (you sent it yourself)
//   node scripts/followup.mjs --skip <NNN> <day> [note]
import { loadConfig, today } from '../lib/config.mjs';
import { readTracker, setStatus } from '../lib/tracker.mjs';
import { readFollowups, writeFollowups, dueFollowups } from '../lib/followups.mjs';

const args = process.argv.slice(2);
const th = loadConfig('thresholds');
const fu = readFollowups();

if (args[0] === '--sent' || args[0] === '--skip') {
  const [, id, day, ...rest] = args;
  const item = fu.items.find((i) => i.id === id && String(i.day) === String(day));
  if (!item) { console.error(`[followup] no draft for ${id} day ${day}`); process.exit(1); }
  item.status = args[0] === '--sent' ? 'sent' : 'skipped';
  item.status_note = `${today()}${rest.length ? ' ' + rest.join(' ') : ''}`;
  writeFollowups(fu);
  if (item.status === 'sent') { try { setStatus(id, 'submitted', { note: `follow-up day ${day} sent`, next: '' }); } catch { /* row may have moved on */ } }
  console.log(`[followup] ${id} day ${day} → ${item.status}`);
  process.exit(0);
}

const tracker = readTracker();
const due = dueFollowups(tracker.rows, fu.items, th.followup_days ?? [7, 14]);
for (const d of due) {
  fu.items.push({ id: d.id, day: d.day, title: `${d.row.company} — ${d.row.title}`, status: 'draft', created: today(), lines: [
    `applied: ${d.row.applied} via ${d.row.channel}`, `url: ${d.row.url}`, '',
    '### Draft', '', '(modes/followup.md writes 4 to 6 sentences here: reference the role and date, one new proof point, one question, polite close)', '',
  ] });
  console.log(`[followup] new draft stub: ${d.id} day ${d.day} ${d.row.company} — ${d.row.title}`);
}
if (due.length) writeFollowups(fu);
const drafts = fu.items.filter((i) => i.status === 'draft');
console.log(`[followup] due=${due.length} drafts_waiting=${drafts.length}` + (drafts.length ? '\n  ' + drafts.map((i) => `${i.id} day ${i.day}  ${i.title}`).join('\n  ') : ''));
