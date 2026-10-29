// data/tracker.md: one row per submitted application. Markdown table so it reads well in any viewer.
// | # | Company | Title | URL | Channel | Status | Applied | Last update | Next action |
import fs from 'node:fs';
import { P } from './paths.mjs';
import { today } from './config.mjs';
import { appendTsv } from './tsv.mjs';

export const COLS = ['id', 'company', 'title', 'url', 'channel', 'status', 'applied', 'updated', 'next'];
const HEADER = '| # | Company | Title | URL | Channel | Status | Applied | Last update | Next action |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const esc = (v) => String(v ?? '').replace(/\|/g, '｜').replace(/\r?\n/g, ' ').trim();

export function parseTracker(text) {
  const rows = [];
  const lines = String(text).split(/\r?\n/);
  const headIdx = lines.findIndex((l) => /^\|\s*#\s*\|/.test(l));
  const preamble = headIdx >= 0 ? lines.slice(0, headIdx).join('\n').replace(/\s+$/, '') : String(text).replace(/\s+$/, '');
  for (const l of lines.slice(headIdx + 2)) {
    if (!/^\|/.test(l)) continue;
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < COLS.length) continue;
    rows.push(Object.fromEntries(COLS.map((k, i) => [k, cells[i]])));
  }
  return { preamble, rows };
}
export function readTracker(file = P.data('tracker.md')) {
  return parseTracker(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Applications tracker\n');
}
export function writeTracker({ preamble, rows }, file = P.data('tracker.md')) {
  fs.writeFileSync(file, `${preamble}\n\n${HEADER}\n${rows.map((r) => `| ${COLS.map((k) => esc(r[k])).join(' | ')} |`).join('\n')}\n`);
}
export function addApplication({ id, company, title, url, channel, status = 'submitted', next = '' }, file) {
  const t = readTracker(file);
  if (t.rows.some((r) => r.id === id)) throw new Error(`tracker already has #${id}`);
  t.rows.push({ id, company, title, url, channel, status, applied: today(), updated: today(), next });
  writeTracker(t, file);
  return t.rows[t.rows.length - 1];
}
export function setStatus(id, status, { next, note = '', file, logFile = P.data('status-log.tsv') } = {}) {
  const t = readTracker(file);
  const r = t.rows.find((x) => x.id === id);
  if (!r) throw new Error(`tracker has no #${id}`);
  const from = r.status;
  r.status = status; r.updated = today();
  if (next !== undefined) r.next = next;
  writeTracker(t, file);
  appendTsv(logFile, ['date', 'url', 'from', 'to', 'reason'], { date: today(), url: r.url, from, to: status, reason: note });
  return r;
}
/** Same company + similar title already tracked via another channel → S5 must stop and ask (design S5 auto gate). */
export function duplicateChannel({ company, title, channel }, file) {
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return readTracker(file).rows.find((r) => norm(r.company) === norm(company) && norm(r.title) === norm(title) && r.channel !== channel) ?? null;
}
/** Applications submitted today per site, from data/applications-log.tsv. */
export function countToday(site, file = P.data('applications-log.tsv')) {
  if (!fs.existsSync(file)) return { site: 0, total: 0 };
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split('\t'));
  const t = today();
  const todayRows = rows.filter((r) => r[0] === t);
  return { site: todayRows.filter((r) => r[1] === site).length, total: todayRows.length };
}
export function logApplication(site, url, file = P.data('applications-log.tsv')) {
  appendTsv(file, ['date', 'site', 'url'], { date: today(), site, url });
}
