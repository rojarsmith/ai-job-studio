#!/usr/bin/env node
// Pay intelligence over every report: how much pay is disclosed, what the market pays per source and per target title,
// where your floor sits, the best-paying postings, and open candidates that pay below your floor. Read-only on reports
// unless --backfill. Figures are yearly, in profile.yml salary.currency (see thresholds.yml pay: for months and fx).
//   node scripts/pay.mjs [--source 104] [--title "product|產品"] [--since 2026-10-01] [--open] [--top 15] [--write]
//   node scripts/pay.mjs --backfill [--force]     write `pay:` into reports that lack it (--force recomputes all)
//   node scripts/pay.mjs --refetch cake           re-read the posting for reports of that source with no salary text
//                                                 (after an adapter learns to read pay), then rewrite their `pay:`
// Market figures are split by the currency a posting pays in: Taiwan and US pay are different markets even after fx.
import fs from 'node:fs';
import { loadConfig, payOptions, payOptionsText } from '../lib/config.mjs';
import { listReports, readReport, writeReport, reportPay } from '../lib/report.mjs';
import { floorOf, verdict, midpoint, quantile, money, payLabel } from '../lib/salary.mjs';
import { P } from '../lib/paths.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const opts = payOptions();
const cur = opts.currency;

if (opt('--refetch')) {
  const { adapterForUrl } = await import('../adapters/index.mjs');
  const { politeDelay } = await import('../lib/http.mjs');
  const { shutdown } = await import('../lib/shutdown.mjs');
  const src = opt('--refetch');
  let n = 0, gone = 0, errors = 0;
  for (const file of listReports()) {
    const rep = readReport(file);
    if (String(rep.front.source) !== src || rep.front.salary) continue;
    const a = adapterForUrl(rep.front.url);
    if (!a) continue;
    try {
      const job = await a.detail(rep.front.url);
      if (!job) { gone++; continue; }
      rep.front.salary = job.salary ?? '';
      rep.front.pay = reportPay(rep, opts, { recompute: true });
      writeReport(file, rep);
      n++;
      console.log(`[pay] ${file}: ${rep.front.salary || '(no pay on the posting)'}`);
    } catch (e) { errors++; console.error(`[pay] ${file}: ${e.message}`); }
    await politeDelay();
  }
  console.log(`[pay] refetched ${n}, closed ${gone}, errors ${errors}`);
  await shutdown();
  process.exit(0);
}

if (args.includes('--backfill')) {
  const force = args.includes('--force');
  let n = 0;
  for (const file of listReports()) {
    const rep = readReport(file);
    if (rep.front.pay && !force) continue;
    rep.front.pay = reportPay(rep, opts, { recompute: true });
    writeReport(file, rep);
    n++;
  }
  console.log(`[pay] wrote pay: into ${n} report(s)`);
  process.exit(0);
}

const source = opt('--source'), since = opt('--since'), top = Number(opt('--top') ?? 15), open = args.includes('--open');
const titleRe = opt('--title') ? new RegExp(opt('--title'), 'i') : null;
const floor = floorOf(opts.salary, opts);
const targets = (loadConfig('profile').target_titles ?? []).map(String);
// A posting belongs to the first target title whose words all appear in its title.
const groupOf = (title) => targets.find((t) => t.toLowerCase().split(/\s+/).filter(Boolean).every((w) => String(title).toLowerCase().includes(w))) ?? 'other';

const rows = listReports().map((file) => {
  const rep = readReport(file);
  const f = rep.front;
  const pay = reportPay(rep, opts);
  const annual = pay.annual_min != null || pay.annual_max != null ? { currency: pay.annual_currency, min: pay.annual_min, max: pay.annual_max } : null;
  return { file, id: f.id, company: f.company, title: f.title, source: String(f.source ?? ''), found: String(f.found ?? ''), url: f.url,
    score: f.score, action: f.action, pay, annual, verdict: verdict(annual, floor, cur), group: groupOf(f.title), market: pay.currency ?? '' };
}).filter((r) => (!source || r.source === source) && (!since || r.found >= since) && (!titleRe || titleRe.test(r.title))
  && (!open || ['apply', 'maybe'].includes(r.action) || r.score == null));

// Market figures use disclosed pay only: a 面議 floor is a legal minimum, not a data point.
const disclosed = (r) => (r.pay.basis === 'stated' || r.pay.basis === 'description') && r.annual;
const inCur = (r) => disclosed(r) && r.annual.currency === cur;
const cell = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const stats = (list) => {
  const v = list.map((r) => midpoint(r.annual)).filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? `${v.length} | ${money(quantile(v, 0.25))} | ${money(quantile(v, 0.5))} | ${money(quantile(v, 0.75))} | ${money(v.at(-1))}` : '0 | | | |';
};
const homeFirst = (groups) => groups.sort((x, y) => (y[0] === cur) - (x[0] === cur));
const by = (list, key) => Object.entries(list.reduce((m, r) => ((m[r[key]] ??= []).push(r), m), {})).sort((a, b) => b[1].length - a[1].length);

const out = [];
const scope = [open && 'open candidates', source && `source ${source}`, titleRe && `title /${titleRe.source}/`, since && `since ${since}`].filter(Boolean).join(', ');
out.push(`# Pay intelligence${scope ? ` (${scope})` : ''}`, '',
  `${rows.length} report(s). Yearly figures in ${cur}. Midpoint of each range, or its stated bound.`, '',
  payOptionsText(opts, new Set(rows.map((r) => r.pay.annual_fx && r.pay.currency).filter(Boolean))).split('\n').map((l) => `- ${l}`).join('\n'), '');

out.push('## Disclosure', '', '| source | reports | stated | in JD | 面議 (≥ legal floor) | negotiable | none |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const [s, list] of by(rows, 'source')) {
  const c = (b) => list.filter((r) => r.pay.basis === b).length;
  out.push(`| ${s} | ${list.length} | ${c('stated')} | ${c('description')} | ${c('implied')} | ${c('negotiable')} | ${c('none')} |`);
}

const markets = homeFirst(by(rows.filter(inCur), 'market'));
out.push('', `## Market (${cur}/yr, disclosed pay only)`, '', 'Split by the currency the posting pays in; foreign pay is converted with thresholds.yml pay.fx.', '',
  '| market | group | n | p25 | median | p75 | max |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const [m, inMarket] of markets) {
  out.push(`| ${m} | all | ${stats(inMarket)} |`);
  for (const [s, list] of by(inMarket, 'source')) if (list.length < inMarket.length) out.push(`| ${m} | source: ${s} | ${stats(list)} |`);
  if (targets.length) for (const [g, list] of by(inMarket, 'group')) out.push(`| ${m} | title: ${g} | ${stats(list)} |`);
}
const foreign = rows.filter((r) => disclosed(r) && r.annual.currency !== cur);
if (foreign.length) out.push('', `${foreign.length} posting(s) in currencies without an fx rate (${[...new Set(foreign.map((r) => r.annual.currency))].join(', ')}): add them under thresholds.yml pay.fx to include them.`);

out.push('', '## Your floor', '');
if (!floor) out.push('No floor set: add salary.monthly_min or salary.annual_min to source/profile.yml.');
else {
  // Your floor is compared with postings paid in your own currency; foreign pay is a different market.
  const home = rows.filter((r) => inCur(r) && r.market === cur);
  const v = home.map((r) => midpoint(r.annual)).filter(Number.isFinite).sort((a, b) => a - b);
  const pct = v.length ? Math.round((v.filter((x) => x < floor).length / v.length) * 100) : null;
  const counts = Object.fromEntries(['meets', 'open', 'below'].map((k) => [k, home.filter((r) => r.verdict === k).length]));
  out.push(`Floor ${cur} ${money(floor)}/yr.${pct != null ? ` ${pct}% of ${v.length} disclosed ${cur} postings have a midpoint below it.` : ''}`,
    `${cur} postings: ${counts.meets} clear it, ${counts.open} straddle it, ${counts.below} top out below it.`);
}

const amountOf = (r) => r.annual.max ?? r.annual.min;
for (const [m, inMarket] of markets) {
  const best = inMarket.sort((a, b) => amountOf(b) - amountOf(a)).slice(0, top);
  out.push('', `## Best paying, ${m} postings (top ${best.length})`, '', '| id | pay | score | role | company |', '| --- | --- | --- | --- | --- |');
  for (const r of best) out.push(`| ${r.id} | ${payLabel(r.pay, { full: true })} | ${r.score ?? ''}${r.action ? ` ${r.action}` : ''} | [${cell(r.title)}](${r.url}) | ${cell(r.company)} |`);
}

const low = rows.filter((r) => ['apply', 'maybe'].includes(r.action) && r.verdict === 'below');
if (low.length) {
  out.push('', '## Open candidates paying below your floor', '', '| id | pay | score | role | company |', '| --- | --- | --- | --- | --- |');
  for (const r of low) out.push(`| ${r.id} | ${payLabel(r.pay, { full: true })} | ${r.score} ${r.action} | [${cell(r.title)}](${r.url}) | ${cell(r.company)} |`);
}

const text = out.join('\n') + '\n';
console.log(text);
if (args.includes('--write')) {
  const f = P.data('pay.md');
  fs.writeFileSync(f, text);
  console.error(`[pay] wrote ${f}`);
}
