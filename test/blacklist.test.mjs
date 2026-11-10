import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blacklistReason, companyKey } from '../lib/blacklist.mjs';

test('companyKey drops punctuation, case and legal suffixes', () => {
  assert.equal(companyKey('範例網路股份有限公司'), companyKey('範例網路(股)公司'));
  assert.equal(companyKey('範例網路有限公司'), '範例網路');
  assert.equal(companyKey('Example Widgets Co., Ltd.'), 'examplewidgets');
  assert.equal(companyKey('EXAMPLE WIDGETS INC'), 'examplewidgets');
});
test('exact company names match across suffix spellings', () => {
  const bl = { companies: ['範例網路股份有限公司'] };
  assert.equal(blacklistReason({ company: '範例網路(股)公司', title: 'x' }, bl), 'company:範例網路股份有限公司');
  assert.equal(blacklistReason({ company: '範例網路科技股份有限公司', title: 'x' }, bl), null);
});
test('Han keywords match as substrings, with except', () => {
  const bl = { company_keywords: [{ keyword: '範例網路', except: ['範例網路書店'] }] };
  assert.equal(blacklistReason({ company: '範例網路股份有限公司' }, bl), 'company~:範例網路');
  assert.equal(blacklistReason({ company: '範例集團_範例網路科技股份有限公司' }, bl), 'company~:範例網路');
  assert.equal(blacklistReason({ company: '範例網路書店股份有限公司' }, bl), null);
  assert.equal(blacklistReason({ company: '範例科技股份有限公司' }, bl), null);
});
test('Latin keywords match whole words only', () => {
  const bl = { company_keywords: ['Acme Data'] };
  assert.equal(blacklistReason({ company: 'ACME Data Ltd.' }, bl), 'company~:Acme Data');
  assert.equal(blacklistReason({ company: 'Acme-Data Inc' }, bl), 'company~:Acme Data');
  assert.equal(blacklistReason({ company: 'Acme Database Corp' }, bl), null);
  assert.equal(blacklistReason({ company: 'NewAcme Data' }, bl), null);
});
test('keywords too short to be safe are ignored', () => {
  const bl = { company_keywords: ['網', 'ab'] };
  assert.equal(blacklistReason({ company: '網路公司' }, bl), null);
  assert.equal(blacklistReason({ company: 'AB Corp' }, bl), null);
});
