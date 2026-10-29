// data/sessions.tsv: site, last_login, last_verified, mfa, locked (ISO date of lock or empty)
import fs from 'node:fs';
import { P } from './paths.mjs';
import { readTsv } from './tsv.mjs';
import { today } from './config.mjs';

export const COLS = ['site', 'last_login', 'last_verified', 'mfa', 'locked'];
const file = () => P.data('sessions.tsv');

export function readSessions() { return readTsv(file()); }
export function getSession(site) { return readSessions().find((r) => r.site === site) ?? null; }
export function upsertSession(site, patch) {
  const rows = readSessions();
  let row = rows.find((r) => r.site === site);
  if (!row) { row = Object.fromEntries(COLS.map((c) => [c, ''])); row.site = site; rows.push(row); }
  Object.assign(row, patch);
  fs.writeFileSync(file(), COLS.join('\t') + '\n' + rows.map((r) => COLS.map((c) => String(r[c] ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n') + (rows.length ? '\n' : ''));
  return row;
}
/** Locked within the last `hours` → still locked (design 5.4: wait 24 h, then a human looks). */
export function isLocked(site, hours = 24) {
  const s = getSession(site);
  if (!s?.locked) return false;
  const t = Date.parse(s.locked);
  return Number.isFinite(t) && Date.now() - t < hours * 3600000;
}
export function markLocked(site) { return upsertSession(site, { locked: new Date().toISOString() }); }
export function markVerified(site, { login = false, mfa } = {}) {
  const patch = { last_verified: today(), locked: '' };
  if (login) patch.last_login = today();
  if (mfa) patch.mfa = mfa;
  return upsertSession(site, patch);
}
