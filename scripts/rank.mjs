#!/usr/bin/env node
// Ranked list of scored reports, best fit first. Read-only on reports; with --write also saves generated/data/ranking.md.
//   node scripts/rank.mjs [--source tsmc] [--min 3] [--all] [--min-pay 1500000] [--write]
// Order: overall score, then skills, then seniority, then the mean of the five dimensions. Skipped rows are hidden
// unless --all. The pay column is yearly in profile.yml salary.currency (lib/salary.mjs); ▼ marks pay that tops out below
// your floor. --min-pay N hides rows whose known yearly maximum is under N (unknown pay stays). The note column shows the first knock-out the scorer wrote (visa, level mismatch, already applied ...).
import fs from 'node:fs';
import { listReports, readReport, reportPay } from '../lib/report.mjs';
import { payOptions } from '../lib/config.mjs';
import { floorOf, payLabel, verdict } from '../lib/salary.mjs';
import { P } from '../lib/paths.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const source = opt('--source');
const min = Number(opt('--min') ?? 3);
const all = args.includes('--all');
const minPay = Number(opt('--min-pay') ?? 0);
const payOpts = payOptions();
const floor = floorOf(payOpts.salary, payOpts);
const mean = (s) => { const v = Object.values(s ?? {}).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

const rows = listReports().map((file) => {
  const rep = readReport(file);
  const { front: f, body } = rep;
  const pay = reportPay(rep, payOpts);
  const annual = { currency: pay.annual_currency, min: pay.annual_min, max: pay.annual_max };
  const note = body.match(/^- knock-outs:\s*(.*)$/m)?.[1]?.trim() ?? '';
  return { id: f.id, score: f.score, action: f.action, title: f.title, company: f.company, source: f.source, url: f.url, location: f.location, by: f.scored_by, s: f.scores ?? {}, note, file,
    pay: payLabel(pay) + (verdict(annual, floor, payOpts.currency) === 'below' ? ' ▼' : ''),
    payMax: annual.currency === payOpts.currency ? annual.max ?? annual.min : null };
}).filter((r) => Number.isFinite(r.score) && (!source || r.source === source) && (all || r.score >= min) && (!minPay || r.payMax == null || r.payMax >= minPay))
  .sort((a, b) => b.score - a.score || (b.s.skills ?? 0) - (a.s.skills ?? 0) || (b.s.seniority ?? 0) - (a.s.seniority ?? 0) || mean(b.s) - mean(a.s) || a.id.localeCompare(b.id));

const cell = (t) => String(t).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const lines = [`# Ranking${source ? ` (${source})` : ''}`, '', `${rows.length} report(s), score ≥ ${all ? 1 : min}, best first.`,
  `Pay: yearly in ${payOpts.currency}${floor ? `; ▼ = tops out below your floor ${payOpts.currency} ${floor}` : ''}${minPay ? `; hidden below ${payOpts.currency} ${minPay} (--min-pay)` : ''}. Settings: node scripts/pay.mjs.`, '',
  '| # | score | action | skills | level | pay | id | role | note |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r, i) => `| ${i + 1} | ${r.score} | ${r.action} | ${r.s.skills ?? ''} | ${r.s.seniority ?? ''} | ${r.pay} | ${r.id} | [${cell(r.title)}](${r.url}) | ${cell(r.note === 'none' ? '' : r.note).slice(0, 110)} |`)];
const out = lines.join('\n') + '\n';
console.log(out);
if (args.includes('--write')) {
  const f = P.data('ranking.md');
  fs.writeFileSync(f, out);
  console.error(`[rank] wrote ${f}`);
}
