import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePay, payOf, annualize, fxRate, withAnnual, floorOf, verdict, payFront, payLabel, quantile, midpoint } from '../lib/salary.mjs';

const pick = (p) => ({ kind: p.kind, period: p.period, currency: p.currency, min: p.min, max: p.max });

test('parsePay: 104 field formats', () => {
  assert.deepEqual(pick(parsePay('月薪40,000~60,000元')), { kind: 'range', period: 'month', currency: 'TWD', min: 40000, max: 60000 });
  assert.deepEqual(pick(parsePay('月薪55,000元以上')), { kind: 'min', period: 'month', currency: 'TWD', min: 55000, max: null });
  assert.deepEqual(pick(parsePay('年薪1,000,000~1,400,000元')), { kind: 'range', period: 'year', currency: 'TWD', min: 1000000, max: 1400000 });
  assert.deepEqual(pick(parsePay('時薪200~250元')), { kind: 'range', period: 'hour', currency: 'TWD', min: 200, max: 250 });
  assert.equal(parsePay('待遇面議').kind, 'negotiable');
  assert.equal(parsePay('').kind, 'none');
});

test('parsePay: 萬 / K scale written once after a range', () => {
  assert.deepEqual(pick(parsePay('年薪 120-180萬')), { kind: 'range', period: 'year', currency: 'TWD', min: 1200000, max: 1800000 });
  assert.deepEqual(pick(parsePay('月薪5萬~7萬')), { kind: 'range', period: 'month', currency: 'TWD', min: 50000, max: 70000 });
  assert.deepEqual(pick(parsePay('年薪 50-80萬')), { kind: 'range', period: 'year', currency: 'TWD', min: 500000, max: 800000 });
  assert.deepEqual(pick(parsePay('$150K – $200K • Offers Equity')), { kind: 'range', period: 'year', currency: 'USD', min: 150000, max: 200000 });
});

test('parsePay: Cake and English formats, currency codes beat a bare $', () => {
  assert.deepEqual(pick(parsePay('月薪 50000~80000 TWD')), { kind: 'range', period: 'month', currency: 'TWD', min: 50000, max: 80000 });
  assert.deepEqual(pick(parsePay('The salary range for this role is $240,000 CAD - $300,000 CAD.')), { kind: 'range', period: 'year', currency: 'CAD', min: 240000, max: 300000 });
  assert.deepEqual(pick(parsePay('$270,000&mdash;$340,000 USD')), { kind: 'range', period: 'year', currency: 'USD', min: 270000, max: 340000 });
  assert.deepEqual(pick(parsePay('base pay range is $230,000 to $340,000')), { kind: 'range', period: 'year', currency: 'USD', min: 230000, max: 340000 });
  assert.deepEqual(pick(parsePay('up to €90k per year')), { kind: 'max', period: 'year', currency: 'EUR', min: null, max: 90000 });
  assert.deepEqual(pick(parsePay('NT$ 1,800,000 annual')), { kind: 'min', period: 'year', currency: 'TWD', min: 1800000, max: null });
});

test('parsePay: bare small numbers are not pay', () => {
  assert.equal(parsePay('salary: 3-5 years experience').kind, 'none');
  assert.equal(parsePay('compensation team of 5 Kubernetes experts').kind, 'none');
});

test('payOf: field, then description, then what 面議 implies, then nothing', () => {
  assert.equal(payOf({ salary: '月薪60,000~80,000元' }).basis, 'stated');
  const jd = payOf({ salary: '', source: 'greenhouse', description: 'We offer a rent subsidy of $3,000.\nThe base pay range for this role is $180,000 - $220,000.' }, { currency: 'TWD' });
  assert.deepEqual([jd.basis, jd.currency, jd.min, jd.max], ['description', 'USD', 180000, 220000]);
  const implied = payOf({ salary: '待遇面議', source: '104' });
  assert.deepEqual([implied.basis, implied.period, implied.min], ['implied', 'month', 40000]);
  assert.equal(payOf({ salary: '', source: 'greenhouse', description: 'Referral bonus up to 40,000.' }, { currency: 'USD' }).basis, 'none');
  assert.equal(payOf({ salary: 'Competitive salary', source: 'ashby' }, { currency: 'USD' }).basis, 'negotiable');
});

test('description pitfalls: percentages, revenue, mixed period words, missing currency', () => {
  const us = { source: 'greenhouse', location: 'San Francisco, CA' };
  assert.equal(payOf({ ...us, description: 'Sales roles are eligible for incentive pay of up to 100% of the offered base salary.' }).basis, 'none');
  assert.equal(payOf({ ...us, description: 'Built compensation design at companies with $100M+ annual recurring revenue.' }).basis, 'none');
  const sf = payOf({ ...us, description: 'The San Francisco base pay range for this role is 262,000-348,000.' });
  assert.deepEqual([sf.currency, sf.period, sf.min], ['USD', 'year', 262000]);
  const tw = payOf({ source: '104', location: '台北市', salary: '待遇面議', description: '月薪依能力與經歷核敘；績效達平均者，年薪約81~108萬。' });
  assert.deepEqual([tw.basis, tw.period, tw.min, tw.max], ['description', 'year', 810000, 1080000]);
  assert.equal(parsePay('無經驗者月薪上看 10 萬元').kind, 'max');
  const ms = payOf({ source: 'microsoft', location: 'United States, Redmond', description: 'IC4 - The typical base pay range for this role across the U.S. is USD $100,000 - $200,000 per year. There is a different range in some metro areas, and the base pay range there is USD $130,000 - $250,000 per year.' });
  assert.deepEqual([ms.min, ms.max], [100000, 200000]);
  // 面議 implies the Taiwan floor only for Taiwan postings
  assert.equal(payOf({ source: 'greenhouse', location: 'Taipei, Taiwan', salary: '', description: 'Salary: negotiable' }).basis, 'implied');
  assert.equal(payOf({ source: 'greenhouse', location: 'Berlin', salary: '', description: 'Salary: negotiable' }).basis, 'negotiable');
});

test('annualize: months, hours, fx; unconvertible stays in its own currency', () => {
  const opts = { currency: 'TWD', months_per_year: 14, fx: { USD: 30 } };
  assert.deepEqual(annualize({ period: 'month', currency: 'TWD', min: 50000, max: 70000 }, opts), { currency: 'TWD', min: 700000, max: 980000, rate: null });
  assert.deepEqual(annualize({ period: 'year', currency: 'USD', min: 100000, max: null }, opts), { currency: 'TWD', min: 3000000, max: null, rate: 30 });
  assert.deepEqual(annualize({ period: 'hour', currency: 'TWD', min: 200, max: null }, opts), { currency: 'TWD', min: 416000, max: null, rate: null });
  assert.deepEqual(annualize({ period: 'year', currency: 'CAD', min: 1, max: 2 }, opts), { currency: 'CAD', min: 1, max: 2, rate: null });
  assert.equal(annualize({ period: null, min: null, max: null }, opts), null);
});

test('currency settings: fx cross rates, shared symbols, board currency, the 面議 floor', () => {
  // fx is "units of fx_base per 1 X": a user in USD still converts with a TWD-based table.
  assert.equal(fxRate('EUR', 'USD', { USD: 30, EUR: 33 }, 'TWD'), 1.1);
  assert.equal(fxRate('TWD', 'USD', { USD: 32 }, 'TWD'), 1 / 32);
  assert.equal(fxRate('GBP', 'USD', { USD: 30 }, 'TWD'), null);
  const usdUser = annualize({ period: 'month', currency: 'TWD', min: 64000, max: null }, { currency: 'USD', fx: { USD: 32 }, fx_base: 'TWD' });
  assert.deepEqual([usdUser.currency, usdUser.min], ['USD', 24000]);
  // "$" and "元" follow pay.symbols
  assert.equal(parsePay('$120,000 - $150,000 per year').currency, 'USD');
  assert.equal(parsePay('$120,000 - $150,000 per year', { symbols: { $: 'CAD' } }).currency, 'CAD');
  assert.equal(parsePay('月薪15,000~20,000元', { symbols: { '元': 'CNY' } }).currency, 'CNY');
  // board_currency adds a board; default_currency covers what nothing else names
  assert.equal(payOf({ source: 'jobsdb', salary: '月薪 30,000~40,000' }, { board_currency: { jobsdb: 'HKD' } }).currency, 'HKD');
  assert.equal(payOf({ source: 'other', salary: '50,000 ~ 60,000 monthly' }, { default_currency: 'SGD', currency: 'TWD' }).currency, 'SGD');
  // negotiable_floor: null turns it off; a different amount is used as given
  assert.equal(payOf({ source: '104', salary: '待遇面議' }, { negotiable_floor: null }).basis, 'negotiable');
  assert.equal(payOf({ source: '104', salary: '待遇面議' }, { negotiable_floor: { amount: 45000, currency: 'TWD', period: 'month' } }).min, 45000);
});

test('withAnnual: a stored pay block follows the current fx and months', () => {
  const stored = payFront({ salary: '$100,000 - $120,000', source: 'ashby' }, { currency: 'TWD', fx: { USD: 30 } });
  assert.equal(stored.annual_fx, 30);
  const now = withAnnual(stored, { currency: 'TWD', fx: { USD: 32 } });
  assert.deepEqual([now.annual_min, now.annual_fx], [3200000, 32]);
  const none = withAnnual(stored, { currency: 'TWD', fx: {} });
  assert.deepEqual([none.annual_currency, none.annual_min, none.annual_fx], ['USD', 100000, null]);
});

test('floorOf and verdict', () => {
  assert.equal(floorOf({ monthly_min: 80000 }, { months_per_year: 13 }), 1040000);
  assert.equal(floorOf({ annual_min: 1500000, monthly_min: 80000 }), 1500000);
  assert.equal(floorOf({}), null);
  const f = 1200000;
  assert.equal(verdict({ currency: 'TWD', min: 600000, max: 900000 }, f, 'TWD'), 'below');
  assert.equal(verdict({ currency: 'TWD', min: 1300000, max: null }, f, 'TWD'), 'meets');
  assert.equal(verdict({ currency: 'TWD', min: 1000000, max: 1500000 }, f, 'TWD'), 'open');
  assert.equal(verdict({ currency: 'USD', min: 1, max: 2 }, f, 'TWD'), 'unknown');
  assert.equal(verdict(null, f, 'TWD'), 'unknown');
});

test('payFront and payLabel', () => {
  const front = payFront({ salary: '月薪50,000~70,000元' }, { currency: 'TWD', months_per_year: 12 });
  assert.equal(front.annual_min, 600000);
  assert.equal(payLabel(front), 'TWD 600k–840k/yr');
  assert.equal(payLabel(payFront({ salary: '待遇面議', source: '104' })), 'TWD ≥480k/yr (面議)');
  assert.equal(payLabel(payFront({ salary: '' })), '');
  assert.equal(payLabel(front, { full: true }), 'TWD 50k–70k/mo = 600k–840k/yr');
  const usd = payFront({ salary: '$150K – $200K', source: 'ashby' }, { currency: 'TWD', fx: { USD: 30 } });
  assert.equal(payLabel(usd, { full: true }), 'USD 150k–200k/yr ≈ TWD 4.5M–6M/yr');
});

test('quantile and midpoint', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 3);   // rounded 2.5
  assert.equal(quantile([], 0.5), null);
  assert.equal(midpoint({ min: 10, max: 20 }), 15);
  assert.equal(midpoint({ min: 10, max: null }), 10);
});

test('reportPay: uses frontmatter pay, else reads the salary field and the job description of an older report', async () => {
  const { buildReport, reportPay, section } = await import('../lib/report.mjs');
  const job = { url: 'https://x/1', company: 'Acme', title: 'Engineer', source: 'greenhouse', location: 'Austin, TX', salary: '',
    description: 'Build things.\nThe base pay range for this role is $120,000 - $150,000 per year.', requirements: '5 years' };
  const rep = buildReport('001', job, { found: '2026-11-01' });
  assert.equal(rep.front.pay, null);
  assert.match(section(rep.body, 'Job description'), /base pay range/);
  const pay = reportPay(rep, { currency: 'TWD', fx: { USD: 30 } });
  assert.deepEqual([pay.basis, pay.currency, pay.annual_min, pay.annual_max], ['description', 'USD', 3600000, 4500000]);
  // A stored block keeps what was parsed, and its yearly figures follow today's settings.
  rep.front.pay = { basis: 'stated', period: 'month', currency: 'TWD', min: 100000, max: null, annual_currency: 'TWD', annual_min: 1 };
  assert.equal(reportPay(rep, { currency: 'TWD', months_per_year: 13 }).annual_min, 1300000);
});
