// Pay intelligence: turn the many ways a posting states pay into one comparable shape.
//   parsePay(text)        "月薪40,000~60,000元" / "年薪150萬以上" / "$240,000 CAD - $300,000 CAD" / "待遇面議" → { kind, period, currency, min, max }
//   payOf(job, opts)      the salary field first, else a pay sentence in the description, else what 面議 implies in Taiwan
//   annualize(pay, opts)  per-year figures in the target currency (months_per_year, hours_per_year, fx table)
//   floorOf / verdict     the profile's floor and whether a posting clears it
// Pure functions, no I/O: scripts pass the options from thresholds.yml (pay:) and profile.yml (salary:), see payOptions().
// Every currency assumption has a setting: symbols, board_currency, default_currency, negotiable_floor, fx / fx_base.

const CODES = ['USD', 'TWD', 'NTD', 'CAD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'HKD', 'CNY', 'RMB', 'INR', 'CHF', 'KRW'];
const SYMBOLS = [['NT$', 'TWD'], ['US$', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['A$', 'AUD'], ['S$', 'SGD'], ['HK$', 'HKD'], ['$', null], ['€', 'EUR'], ['£', 'GBP'], ['¥', null], ['₹', 'INR']];
const ALIAS = { NTD: 'TWD', RMB: 'CNY' };
const sym = SYMBOLS.map(([s]) => s.replace(/\$/g, '\\$')).join('|');
// One amount: optional symbol or code, digits, optional scale, optional code or 元.
const AMOUNT = new RegExp(`(${sym}|\\b(?:${CODES.join('|')})\\b)?\\s?(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s?((?:mn|k|K|m|M)(?![A-Za-z])|萬|万|千)?(?!\\d|[.,]\\d|\\s?%)\\s?(\\b(?:${CODES.join('|')})\\b|元|台幣|臺幣)?`, 'g');
const RANGE_SEP = /^\s*(?:~|～|-|–|—|&mdash;|&ndash;|to|至|到|－)\s*$/i;
const PERIODS = [
  ['month', /月薪|\/\s?月|每月|per\s+month|monthly|\/\s?mo\b|a\s+month/i],
  ['year', /年薪|\/\s?年|每年|per\s+(?:year|annum)|annual|annually|yearly|\/\s?yr\b|a\s+year|\bOTE\b|base\s+salary/i],
  ['hour', /時薪|\/\s?(?:小時|時)|per\s+hour|hourly|\/\s?hr\b|an\s+hour/i],
  ['day', /日薪|\/\s?日|per\s+day|daily/i],
  ['week', /週薪|周薪|per\s+week|weekly/i],
];
const NEGOTIABLE = /面議|待遇面議|薪資面議|negotiable|\bDOE\b|depending on experience|competitive (?:salary|pay|compensation)/i;
const PAY_LINE = /pay range|pay scale|salary|compensation|base pay|\bOTE\b|on-target|年薪|月薪|時薪|薪資|薪水|待遇|底薪/i;
const NOT_PAY = /revenue|\bARR\b|funding|raised|valuation|market cap|營收|融資|資本額|股本/i;
const SCALE = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, mn: 1e6, 萬: 1e4, 万: 1e4, 千: 1e3 };

// Taiwan's Employment Service Act (art. 5) requires an ad to state the pay range when regular monthly pay is under
// NT$40,000, so "面議" on a Taiwan posting implies at least that much. thresholds.yml pay.negotiable_floor changes it.
export const DEFAULT_NEGOTIABLE_FLOOR = { amount: 40000, currency: 'TWD', period: 'month' };
// Symbols several currencies share. thresholds.yml pay.symbols overrides them ("$": CAD for a Canadian search, "元": CNY).
export const DEFAULT_SYMBOLS = { '$': 'USD', '元': 'TWD', '¥': 'JPY' };
// Currency each job board pays in when the posting does not say. thresholds.yml pay.board_currency adds or overrides.
export const DEFAULT_BOARD_CURRENCY = { '104': 'TWD', '1111': 'TWD', yes123: 'TWD', '518': 'TWD', cake: 'TWD', yourator: 'TWD', tsmc: 'TWD' };

const codeOf = (s) => {
  if (!s) return null;
  const u = s.toUpperCase();
  if (CODES.includes(u)) return ALIAS[u] ?? u;
  return SYMBOLS.find(([k]) => k === s)?.[1] ?? null;
};

function amounts(text, symbols) {
  const out = [];
  for (const m of String(text).matchAll(AMOUNT)) {
    const [, pre, num, scale, post] = m;
    const n = Number(num.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    const postCur = post === '台幣' || post === '臺幣' ? 'TWD' : post === '元' ? symbols['元'] : codeOf(post);
    // A shared symbol ("$" is USD, CAD, AUD, SGD ...) is a weak hint; a written code wins over it.
    const shared = pre === '$' || pre === '¥';
    const weak = shared && !postCur;
    const cur = shared ? postCur ?? symbols[pre] ?? null : codeOf(pre) ?? postCur;
    out.push({ n, v: n * (SCALE[scale] ?? 1), factor: SCALE[scale] ?? 1, cur, weak, start: m.index, end: m.index + m[0].length });
  }
  return out;
}
// Bare small numbers without a currency or scale are years of experience, headcounts, dates: not pay.
const moneyLike = (x) => !!(x && (x.cur || x.factor > 1 || x.v >= 100));

// The period word closest before the amount ("月薪依能力核敘；年薪約81~108萬" is per year), else any period word in the text.
function periodAt(raw, pos) {
  let best = null, at = -1;
  for (const [p, re] of PERIODS) {
    for (const m of raw.slice(0, pos).matchAll(new RegExp(re.source, 'gi'))) if (m.index > at) { at = m.index; best = p; }
  }
  return best ?? PERIODS.find(([, re]) => re.test(raw))?.[0] ?? null;
}

const ABROAD = /united states|canada|japan|singapore|germany|united kingdom/i;
/** Currency a posting is paid in when the text does not say: from the job board or the location. null when unclear. */
export function currencyHint(job = {}, opts = {}) {
  const loc = String(job.location ?? '');
  const board = { ...DEFAULT_BOARD_CURRENCY, ...(opts.board_currency ?? {}) }[String(job.source ?? '').toLowerCase()];
  if (board && !ABROAD.test(loc)) return board;
  if (/taiwan|台灣|臺灣|taipei|台北|臺北|hsinchu|新竹|taichung|台中|臺中|tainan|台南|臺南|kaohsiung|高雄|taoyuan|桃園/i.test(loc)) return 'TWD';
  if (/canada|toronto|vancouver|montreal|ottawa/i.test(loc)) return 'CAD';
  if (/united kingdom|\bUK\b|london/i.test(loc)) return 'GBP';
  if (/singapore/i.test(loc)) return 'SGD';
  if (/japan|tokyo/i.test(loc)) return 'JPY';
  if (/united states|\bUSA?\b|, [A-Z]{2}\b|san francisco|new york|seattle|redmond|austin|boston|chicago|los angeles|mountain view/i.test(loc)) return 'USD';
  return null;
}

function guessPeriod(v, cur) {
  if (v < 1000) return 'hour';
  if (cur === 'TWD' || cur === 'JPY' || cur === 'KRW' || cur === 'INR') return v < 400000 ? 'month' : 'year';
  return v < 15000 ? 'month' : 'year';
}

/** Parse one pay statement. kind: range | min | max | negotiable | none. currency: used when the text names none. */
export function parsePay(text, { currency = 'TWD', symbols } = {}) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim();
  const none = { kind: 'none', period: null, currency: null, min: null, max: null, text: raw };
  if (!raw) return none;
  const list = amounts(raw, { ...DEFAULT_SYMBOLS, ...(symbols ?? {}) });
  const pairAt = (i) => (list[i + 1] && RANGE_SEP.test(raw.slice(list[i].end, list[i + 1].start)) ? list[i + 1] : null);
  const i = list.findIndex((x, k) => moneyLike(x) || moneyLike(pairAt(k)));
  if (i < 0) return NEGOTIABLE.test(raw) ? { ...none, kind: 'negotiable' } : none;
  const a = { ...list[i] };
  const b = pairAt(i);
  // "120-180萬" / "$150-200K": a scale written once after the second number applies to both.
  if (b && a.factor === 1 && b.factor > 1 && a.n < 1000) a.v = a.n * b.factor;
  const written = codeOf(raw.match(new RegExp(`\\b(${CODES.join('|')})\\b`))?.[1]);
  const cur = (a.cur && !a.weak ? a.cur : null) ?? (b?.cur && !b.weak ? b.cur : null) ?? written ?? a.cur ?? currency;
  const period = periodAt(raw, a.start) ?? guessPeriod(a.v, cur);
  if (b) {
    const [min, max] = a.v <= b.v ? [a.v, b.v] : [b.v, a.v];
    return { kind: 'range', period, currency: cur, min, max, text: raw };
  }
  const after = raw.slice(a.end, a.end + 6);
  const before = raw.slice(Math.max(0, a.start - 10), a.start);
  if (/up to|最高|上看|可達|以下/i.test(before + after)) return { kind: 'max', period, currency: cur, min: null, max: a.v, text: raw };
  return { kind: 'min', period, currency: cur, min: a.v, max: null, text: raw };
}

/** The first line of a description that states pay (a pay word plus a range or an explicit period), else null. */
export function payFromDescription(text, opts) {
  // Sentence ends: "。；" anywhere, "." only after a lower-case letter or digit and before a capital ("the U.S. is" stays whole).
  for (const line of String(text ?? '').split(/\r?\n|(?<=[。;；])\s*|(?<=[a-z0-9)][.])\s+(?=[A-Z])/)) {
    if (!PAY_LINE.test(line) || NOT_PAY.test(line) || line.length > 400) continue;
    const p = parsePay(line, opts);
    if (p.kind === 'none' || p.kind === 'negotiable') continue;
    if (p.kind === 'range' || PERIODS.some(([, re]) => re.test(line))) return p;
  }
  return null;
}

/** Pay for a job: the salary field, else a pay line in the description, else the floor 面議 implies. basis says which. */
export function payOf(job, opts = {}) {
  const hint = currencyHint(job, opts);
  // Unwritten currency: the board's or location's, else pay.default_currency, else your own.
  const parseOpts = { currency: hint ?? opts.default_currency ?? opts.currency ?? 'TWD', symbols: opts.symbols };
  const field = parsePay(job.salary, parseOpts);
  if (field.kind !== 'none' && field.kind !== 'negotiable') return { basis: 'stated', ...field };
  const desc = payFromDescription(`${job.description ?? ''}\n${job.requirements ?? ''}`, parseOpts);
  if (desc) return { basis: 'description', ...desc };
  const negotiable = field.kind === 'negotiable' || NEGOTIABLE.test(job.description ?? '');
  const nf = opts.negotiable_floor === undefined ? DEFAULT_NEGOTIABLE_FLOOR : opts.negotiable_floor;
  // The legal floor only holds where that law applies: postings paid in the floor's currency.
  if (negotiable && nf?.amount && hint === nf.currency) {
    return { basis: 'implied', kind: 'min', period: nf.period ?? 'month', currency: nf.currency, min: nf.amount, max: null, text: field.text || '面議' };
  }
  return { basis: negotiable ? 'negotiable' : 'none', kind: negotiable ? 'negotiable' : 'none', period: null, currency: null, min: null, max: null, text: field.text };
}

const PER_YEAR = (opts) => ({ year: 1, month: opts.months_per_year ?? 12, week: 52, day: opts.days_per_year ?? 250, hour: opts.hours_per_year ?? 2080 });

/** Units of `to` per 1 `from`. fx holds units of fx_base per 1 of each currency, so any pair in it converts. null when unknown. */
export function fxRate(from, to, fx = {}, base = 'TWD') {
  if (!from || !to) return null;
  if (from === to) return 1;
  const inBase = (c) => (c === base ? 1 : Number(fx?.[c]) > 0 ? Number(fx[c]) : null);
  const a = inBase(from), b = inBase(to);
  return a && b ? a / b : null;
}

/** { currency, min, max, rate } per year in opts.currency when fx can convert it, else in the posting's currency (rate null). */
export function annualize(pay, opts = {}) {
  if (!pay || (pay.min == null && pay.max == null)) return null;
  const target = opts.currency ?? 'TWD';
  const mult = PER_YEAR(opts)[pay.period] ?? 1;
  const rate = fxRate(pay.currency, target, opts.fx, opts.fx_base ?? 'TWD');
  const cur = rate ? target : pay.currency;
  const conv = (v) => (v == null ? null : Math.round(v * mult * (rate ?? 1)));
  return { currency: cur, min: conv(pay.min), max: conv(pay.max), rate: rate && rate !== 1 ? +rate.toPrecision(6) : null };
}

/** Annual floor from profile.salary: annual_min, else monthly_min × months_per_year. In salary.currency; null when unset. */
export function floorOf(salary = {}, opts = {}) {
  if (Number(salary.annual_min) > 0) return Number(salary.annual_min);
  if (Number(salary.monthly_min) > 0) return Number(salary.monthly_min) * (opts.months_per_year ?? 12);
  return null;
}

/** below | meets | open | unknown, comparing annual figures with the floor (same currency only). */
export function verdict(annual, floor, currency) {
  if (!annual || !floor || annual.currency !== currency) return 'unknown';
  if (annual.max != null && annual.max < floor) return 'below';
  if (annual.min != null && annual.min >= floor) return 'meets';
  return 'open';
}

/** Frontmatter block for a report. Flat so it reads well in YAML and survives hand edits. */
export function payFront(job, opts = {}) {
  return withAnnual(payOf(job, opts), opts);
}

/** Yearly figures of a pay block with the current settings (currency, months, fx). Stored reports go through this too,
 *  so a changed fx table or months_per_year shows up without rewriting them. annual_fx: the rate used, null when none. */
export function withAnnual(p, opts = {}) {
  const a = annualize(p, opts);
  return {
    basis: p.basis, period: p.period ?? null, currency: p.currency ?? null, min: p.min ?? null, max: p.max ?? null,
    annual_currency: a?.currency ?? null, annual_min: a?.min ?? null, annual_max: a?.max ?? null, annual_fx: a?.rate ?? null,
  };
}

/** Compact money: 1.2M, 480k, 950. */
export function money(v) {
  if (v == null) return '?';
  if (v >= 1e6) return `${+(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return String(v);
}

const span = (lo, hi) => (lo != null && hi != null ? (lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`) : lo != null ? `≥${money(lo)}` : `≤${money(hi)}`);
const PER = { year: 'yr', month: 'mo', hour: 'hr', day: 'day', week: 'wk' };

/** "TWD 1.2M–1.8M/yr", "TWD ≥480k/yr (面議)"; full: "USD 165k–296k/yr ≈ TWD 5.05M–9.04M/yr". "" when nothing is known. */
export function payLabel(front, { full = false } = {}) {
  if (!front || (front.annual_min == null && front.annual_max == null)) return front?.basis === 'negotiable' ? 'negotiable' : '';
  const tag = front.basis === 'implied' ? ' (面議)' : front.basis === 'description' ? ' (JD)' : '';
  const annual = `${span(front.annual_min, front.annual_max)}/yr`;
  if (!full || (front.currency === front.annual_currency && front.period === 'year')) return `${front.annual_currency} ${annual}${tag}`;
  const stated = `${front.currency} ${span(front.min, front.max)}/${PER[front.period] ?? front.period}`;
  return `${stated} ${front.currency === front.annual_currency ? '=' : `≈ ${front.annual_currency}`} ${annual}${tag}`;
}

/** Linear-interpolated quantile of a sorted numeric array. */
export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

/** One number per posting for market stats: the midpoint of a range, else the stated bound. */
export const midpoint = (a) => (a?.min != null && a?.max != null ? (a.min + a.max) / 2 : a?.min ?? a?.max ?? null);
