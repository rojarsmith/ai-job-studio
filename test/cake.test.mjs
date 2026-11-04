import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toJob, salaryText, pathOf, parseJobPosting } from '../adapters/cake.mjs';
import { adapterForUrl } from '../adapters/index.mjs';
import { makeAllowCheck, makeListedCheck } from '../lib/listed.mjs';

const ROW = { path: 'ai-lead-ab12', title: 'AI Lead', page: { path: 'acme', name: 'Acme 範例科技' }, locations: ['內湖區, 台北市, 台灣'], salary: { min: '2000000', max: '2600000', currency: 'TWD', type: 'per_year' }, content_updated_at: '2026-10-30T08:00:00Z' };

test('search rows become discovery rows with the company page URL', () => {
  const j = toJob(ROW);
  assert.equal(j.url, 'https://www.cake.me/companies/acme/jobs/ai-lead-ab12');
  assert.equal(j.company, 'Acme 範例科技');
  assert.equal(j.location, '內湖區, 台北市, 台灣');
  assert.equal(j.posted, '2026-10-30');
  assert.equal(j.external_id, 'cake:ai-lead-ab12');
  assert.deepEqual(pathOf(j.url), ['acme', 'ai-lead-ab12']);
});

test('JSON-LD baseSalary becomes the same salary text', async () => {
  const { salaryFromLd } = await import('../adapters/cake.mjs');
  assert.equal(salaryFromLd({ currency: 'TWD', value: { minValue: 900000, maxValue: 1300000, unitText: 'YEAR' } }), '年薪 900000~1300000 TWD');
  assert.equal(salaryFromLd({ currency: 'TWD', value: { minValue: 40000, maxValue: 40000, unitText: 'MONTH' } }), '月薪 40000以上 TWD');
  assert.equal(salaryFromLd(undefined), '');
});

test('salary text names the unit and handles missing figures', () => {
  assert.equal(salaryText(ROW.salary), '年薪 2000000~2600000 TWD');
  assert.equal(salaryText({ min: null, max: null, currency: 'TWD', type: 'per_month' }), '');
  assert.equal(salaryText({ min: '45000', max: null, currency: 'TWD', type: 'per_month' }), '月薪 45000~? TWD');
});

test('JobPosting is found among JSON-LD blocks, also inside @graph', () => {
  const posting = { '@type': 'JobPosting', title: 'X' };
  assert.equal(parseJobPosting([JSON.stringify({ '@type': 'Organization' }), JSON.stringify(posting)]).title, 'X');
  assert.equal(parseJobPosting([JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, posting] })]).title, 'X');
  assert.equal(parseJobPosting(['not json', '{}']), null);
});

test('adapterForUrl routes cake.me', () => {
  assert.equal(adapterForUrl('https://www.cake.me/companies/acme/jobs/x').name, 'cake');
});

test('allow list matches by contained name, including "English_中文" employers, and an empty list allows nothing', () => {
  const allow = makeAllowCheck(['Example Search Inc', '範例雲端']);
  assert.equal(allow('Example Search Inc Taiwan Branch'), true);
  assert.equal(allow('Foo Ltd_範例雲端股份有限公司'), true);
  assert.equal(allow('Unrelated Co'), false);
  assert.equal(makeAllowCheck([])('Anything'), false);
  assert.equal(makeAllowCheck(undefined)('Anything'), false);
  // the listed check stays exact
  assert.equal(makeListedCheck(['範例科技股份有限公司'])('範例科技'), true);
});
