import fs from 'node:fs';
import yaml from 'js-yaml';
import { P, WS } from './paths.mjs';
import { normalizeProfile } from './profile.mjs';

// profile and portals are personal: the workspace must provide them. The rest fall back to examples/ defaults.
const REQUIRED = new Set(['profile', 'portals']);
const cache = new Map();
export function loadConfig(name) {
  if (cache.has(name)) return cache.get(name);
  const ws = P.config(`${name}.yml`);
  let file = ws;
  if (!fs.existsSync(ws)) {
    if (REQUIRED.has(name)) throw new Error(`missing ${ws}\nworkspace: ${WS}\nrun: node scripts/workspace.mjs init   (then edit source/${name}.yml)`);
    file = P.exampleConfig(`${name}.yml`);
    if (!fs.existsSync(file)) { cache.set(name, {}); return {}; }  // optional config (browser, sites, credentials): absent means defaults
    console.error(`[config] source/${name}.yml not in workspace, using defaults from examples/`);
  }
  let v = yaml.load(fs.readFileSync(file, 'utf8')) ?? {};
  if (name === 'profile') v = normalizeProfile(v);
  cache.set(name, v);
  return v;
}
/** Options for lib/salary.mjs: thresholds.yml `pay:` (else the examples copy) plus profile.yml salary.currency. */
export function payOptions() {
  let pay = loadConfig('thresholds').pay;
  if (!pay) {
    const ex = P.exampleConfig('thresholds.yml');
    pay = fs.existsSync(ex) ? (yaml.load(fs.readFileSync(ex, 'utf8')) ?? {}).pay ?? {} : {};
  }
  const salary = loadConfig('profile').salary ?? {};
  const up = (c) => (c ? String(c).toUpperCase() : c);
  const upMap = (m) => (m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), up(v)])) : undefined);
  // negotiable_floor: { amount, currency, period } | 0 / null (off); a bare number is a monthly amount in TWD.
  const nf = pay.negotiable_floor;
  const negotiable_floor = nf === undefined ? undefined : !nf ? null
    : typeof nf === 'number' ? { amount: nf, currency: 'TWD', period: 'month' } : { ...nf, currency: up(nf.currency ?? 'TWD') };
  return {
    currency: up(salary.currency ?? 'TWD'),
    default_currency: up(pay.default_currency),
    months_per_year: pay.months_per_year ?? 12, hours_per_year: pay.hours_per_year ?? 2080, days_per_year: pay.days_per_year ?? 250,
    negotiable_floor,
    symbols: upMap(pay.symbols),
    board_currency: pay.board_currency ? Object.fromEntries(Object.entries(pay.board_currency).map(([k, v]) => [String(k).toLowerCase(), up(v)])) : undefined,
    fx_base: up(pay.fx_base ?? 'TWD'),
    fx: Object.fromEntries(Object.entries(pay.fx ?? {}).map(([k, v]) => [up(k), Number(v)])),
    fx_date: pay.fx_date ? String(pay.fx_date) : null,
    salary,
  };
}

/** One line per setting that decides how pay is converted, for the top of pay.mjs / rank.mjs output. */
export function payOptionsText(o, used = null) {
  const fxList = Object.entries(o.fx).filter(([c]) => !used || used.has(c)).map(([c, v]) => `${c} ${v}`).join(', ');
  const nf = o.negotiable_floor === undefined ? { amount: 40000, currency: 'TWD', period: 'month' } : o.negotiable_floor;
  return [
    `Your currency: ${o.currency} (profile.yml salary.currency). Monthly pay × ${o.months_per_year}, hourly × ${o.hours_per_year}, daily × ${o.days_per_year}.`,
    `Fx: units of ${o.fx_base} per 1 unit${o.fx_date ? `, as of ${o.fx_date}` : ', no fx_date set'}${fxList ? `: ${fxList}` : ': none'} (thresholds.yml pay.fx).`,
    `Unwritten currency: board or location, else ${o.default_currency ?? o.currency}. Bare "$" = ${o.symbols?.$ ?? 'USD'}, "元" = ${o.symbols?.['元'] ?? 'TWD'}.`
      + ` 面議 floor: ${nf ? `${nf.currency} ${nf.amount}/${nf.period ?? 'month'}` : 'off'}.`,
  ].join('\n');
}
export const today =() => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();
