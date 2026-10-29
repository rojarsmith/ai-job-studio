// data/pipeline.md is the L3 source of truth for every job before it is submitted.
// Row:  - [ ] url | company | title | source | found | state | score | report
import fs from 'node:fs';
import { P } from './paths.mjs';
import { assertTransition, isTerminal } from './state.mjs';
import { appendTsv } from './tsv.mjs';
import { today } from './config.mjs';

export const COLUMNS = ['url', 'company', 'title', 'source', 'found', 'state', 'score', 'report'];
const ROW_RE = /^- \[([ xX])\] (.+)$/;
const esc = (v) => String(v ?? '-').replace(/\|/g, '｜').trim() || '-';

export function parsePipeline(text) {
  const header = [];
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ROW_RE);
    if (!m) { if (rows.length === 0) header.push(line); continue; }
    const cells = m[2].split('|').map((c) => c.trim());
    const row = Object.fromEntries(COLUMNS.map((k, i) => [k, cells[i] === '-' || cells[i] === undefined ? '' : cells[i]]));
    row.state ||= 'discovered';
    rows.push(row);
  }
  return { header: header.join('\n').replace(/\s+$/, ''), rows };
}
export const formatRow = (r) => `- [${isTerminal(r.state) ? 'x' : ' '}] ${COLUMNS.map((k) => esc(r[k])).join(' | ')}`;
export function readPipeline(file = P.data('pipeline.md')) {
  return parsePipeline(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Pipeline\n');
}
export function writePipeline({ header, rows }, file = P.data('pipeline.md')) {
  fs.writeFileSync(file, `${header}\n\n${rows.map(formatRow).join('\n')}\n`);
}
export function transition(row, to, reason = '', logFile = P.data('status-log.tsv')) {
  const from = row.state;
  if (from === to) return row;
  assertTransition(from, to);
  row.state = to;
  appendTsv(logFile, ['date', 'url', 'from', 'to', 'reason'], { date: today(), url: row.url, from, to, reason });
  return row;
}
