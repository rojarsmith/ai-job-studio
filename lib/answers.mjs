// answers.md → { key: { value, needs_confirmation, section } }. source/answers.md is shared; generated/applications/NNN/answers.md overrides it key by key.
// Line format inside a "## Section":   - key: value   # needs_confirmation
// A whole section titled "(needs_confirmation)" marks every key in it.
export function mergeAnswers(shared, override) {
  const out = { ...shared };
  for (const [k, v] of Object.entries(override)) if (v.value !== '' || !(k in out)) out[k] = v;
  return out;
}

export function parseAnswers(text) {
  const out = {};
  let section = '', sectionFlag = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const h = raw.match(/^##\s+(.+)$/);
    if (h) { section = h[1].trim(); sectionFlag = /needs_confirmation/i.test(section); continue; }
    const m = raw.match(/^-\s+([a-z0-9_]+)\s*:\s*(.*?)\s*(#.*)?$/i);
    if (!m) continue;
    const [, key, value, comment] = m;
    out[key] = { value: value.trim(), needs_confirmation: sectionFlag || /needs_confirmation/i.test(comment ?? ''), section };
  }
  return out;
}

/** Field-label aliases → answers.md keys. Lowercase substring match, longest alias wins. */
export const LABEL_ALIASES = {
  full_name: ['full name', 'your name', '姓名', 'name'],
  first_name: ['first name', 'given name', 'forename', '名字'],
  last_name: ['last name', 'surname', 'family name', '姓氏'],
  email: ['email', 'e-mail', '電子郵件', '信箱'],
  phone: ['phone', 'mobile', 'telephone', '電話', '手機'],
  location: ['location', 'city', 'current location', 'where are you located', '所在地', '居住'],
  linkedin: ['linkedin'],
  website: ['website', 'portfolio', 'personal site', 'github', 'url'],
  resume: ['resume', 'cv', 'curriculum', '履歷'],
  cover_letter: ['cover letter', 'covering letter', '求職信', '自傳'],
  salary_expectation: ['salary', 'compensation', 'expected pay', 'desired pay', '期望薪資', '薪資'],
  notice_period: ['notice period', 'notice', 'availability', 'start date', 'earliest start', '到職', '可上班'],
  earliest_start: ['earliest start', 'start date', 'when can you start'],
  work_authorization_taiwan: ['authorized to work in taiwan', '工作許可'],
  work_authorization_other: ['authorized to work', 'legally authorized', 'work authorization', 'right to work', 'eligible to work'],
  requires_sponsorship: ['sponsorship', 'visa', 'require sponsorship', 'need sponsorship'],
  willing_to_relocate: ['relocate', 'relocation', '外派', '調動'],
  remote_preference: ['remote', 'hybrid', 'on-site preference'],
  why_this_company: ['why do you want to work', 'why are you interested', 'why us', 'why this company'],
  why_this_role: ['why this role', 'why are you a good fit', 'why this position'],
  biggest_achievement: ['achievement', 'proudest', 'accomplishment'],
};

export function matchAnswerKey(label, aliases = LABEL_ALIASES) {
  const l = String(label ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!l) return null;
  let best = null, bestLen = 0;
  for (const [key, list] of Object.entries(aliases)) for (const a of list) if (l.includes(a) && a.length > bestLen) { best = key; bestLen = a.length; }
  return best;
}

/** Split "full_name" into first / last for forms that ask separately. Parenthesised aliases are dropped, then everything
 *  before the last space = first, last token = last ("Lin Mei (Amy Lin)" → first "Lin", last "Mei"). Names without spaces
 *  (CJK) are not split; Eastern name order is the human's call at the confirmation step. */
export function splitName(full) {
  const s = String(full ?? '').replace(/\(.*?\)/g, '').trim();
  if (!s) return { first: '', last: '' };
  if (!/\s/.test(s)) return { first: s, last: '' };
  const parts = s.split(/\s+/);
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}
