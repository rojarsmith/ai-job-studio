import { loadConfig } from './config.mjs';

// Company names are compared on a key: NFKC, lower case, punctuation gone, legal suffixes dropped,
// so "範例網路股份有限公司", "範例網路(股)公司" and "範例網路" share one key.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const ZH_SUFFIX = /(股份有限公司|有限公司|股份公司|股公司|公司)$/;
const EN_SUFFIX = / (co |company )?(ltd|limited|inc|incorporated|corp|corporation|llc|gmbh|plc)$/;
export function companyWords(name) {
  let s = String(name ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/(?<=\p{Script=Han}) (?=\p{Script=Han})/gu, '');   // "網路(股)公司" → "網路股公司"
  for (let prev; prev !== s;) { prev = s; s = s.replace(EN_SUFFIX, '').replace(ZH_SUFFIX, '').trim(); }
  return s;
}
export const companyKey = (name) => companyWords(name).replace(/ /g, '');

// Short keywords ban too much: a Han keyword needs 2+ characters, a Latin one 3+.
const MIN_CJK = 2, MIN_LATIN = 3;
const warned = new Set();
function keywordRule(entry) {
  const raw = typeof entry === 'string' ? entry : entry?.keyword;
  const words = companyWords(raw), key = words.replace(/ /g, '');
  const cjk = CJK.test(key);
  if (!key || key.length < (cjk ? MIN_CJK : MIN_LATIN)) {
    if (!warned.has(raw)) { warned.add(raw); console.error(`[blacklist] company_keywords "${raw}" ignored: shorter than ${cjk ? MIN_CJK : MIN_LATIN} characters`); }
    return null;
  }
  const except = (typeof entry === 'object' && entry?.except ? [].concat(entry.except) : []).map(companyKey).filter(Boolean);
  // Han text has no word breaks, so a substring is the only test. Latin keywords must match whole words: "meta" does not hit "metal".
  const hit = cjk
    ? (w) => w.replace(/ /g, '').includes(key)
    : (w) => ` ${w} `.includes(` ${words} `);
  return { raw, test: (company) => { const w = companyWords(company); return Boolean(w) && hit(w) && !except.some((e) => w.replace(/ /g, '').includes(e)); } };
}

/** Why a job is blacklisted, or null. company: exact name; company~: keyword; title: regex; url: substring. */
export function blacklistReason(job, bl = loadConfig('blacklist')) {
  const key = companyKey(job.company);
  for (const c of bl.companies ?? []) if (key && key === companyKey(c)) return `company:${c}`;
  for (const e of bl.company_keywords ?? []) { const r = keywordRule(e); if (r?.test(job.company)) return `company~:${r.raw}`; }
  for (const p of bl.title_patterns ?? []) if (new RegExp(p, 'i').test(job.title ?? '')) return `title:${p}`;
  for (const u of bl.url_contains ?? []) if (String(job.url ?? '').includes(u)) return `url:${u}`;
  return null;
}
