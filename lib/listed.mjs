// Taiwan-listed company check (TWSE + TPEx, from the exchanges' open data) for sources that set `require_listed: tw`.
// The list is cached under generated/data for a week. Employers on the emerging board (興櫃) are not listed.
import fs from 'node:fs';
import { P } from './paths.mjs';

const SOURCES = [
  { url: 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L', full: '公司名稱', short: '公司簡稱' },
  { url: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O', full: 'CompanyName', short: 'CompanyAbbreviation' },
];
const MAX_AGE_MS = 7 * 86400000;

// "臺灣水泥股份有限公司" and "台灣水泥(股)公司" must compare equal: unify 臺/台, drop the legal-form suffix and spaces.
export const normalizeName = (s) => String(s ?? '').replace(/臺/g, '台').replace(/[（(]股[）)]/g, '')
  .replace(/股份有限公司|有限公司|公司/g, '').replace(/[\s　]+/g, '').toLowerCase();

export function makeListedCheck(names) {
  const set = new Set(names.map(normalizeName).filter(Boolean));
  // 104 sometimes joins an English and a Chinese name with an underscore ("Foo Ltd_某某股份有限公司"): any part may match.
  return (employer) => String(employer ?? '').split(/[_／|]/).some((part) => set.has(normalizeName(part)));
}

export async function loadListedNames({ refresh = false } = {}) {
  const file = P.data('listed-tw.json');
  if (!refresh && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = [];
  for (const s of SOURCES) {
    const res = await fetch(s.url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`listed-company list ${s.url}: HTTP ${res.status}`);
    for (const row of await res.json()) for (const k of [s.full, s.short]) if (row[k]) names.push(row[k]);
  }
  fs.mkdirSync(P.data('.'), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(names));
  return names;
}

export async function listedCheck(opts) {
  return makeListedCheck(await loadListedNames(opts));
}
