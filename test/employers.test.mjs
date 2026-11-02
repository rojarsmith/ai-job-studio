import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByMarketCap } from '../lib/toplisted.mjs';
import { pickCompany, companyJobs } from '../adapters/104.mjs';

test('market-cap ranking multiplies price by shares, skips rows without a price, and keeps the top n', () => {
  const companies = [
    { '公司代號': '1111', '公司簡稱': '甲', '公司名稱': '甲股份有限公司', '已發行普通股數或TDR原股發行股數': '1,000,000,000' },
    { '公司代號': '2222', '公司簡稱': '乙', '公司名稱': '乙股份有限公司', '已發行普通股數或TDR原股發行股數': '500,000,000' },
    { '公司代號': '3333', '公司簡稱': '丙', '公司名稱': '丙股份有限公司', '已發行普通股數或TDR原股發行股數': '9,000,000,000' },
  ];
  const prices = [{ Code: '1111', ClosingPrice: '10.00' }, { Code: '2222', ClosingPrice: '40.5' }, { Code: '3333', ClosingPrice: '' }];
  const top = rankByMarketCap(companies, prices, 2);
  assert.deepEqual(top.map((c) => [c.rank, c.code, c.cap]), [[1, '2222', 203], [2, '1111', 100]]);
  assert.equal(top[0].legal, '乙股份有限公司');
});

test('pickCompany prefers the exact normalised name and ignores bracketed aliases and 臺/台', () => {
  const results = [
    { name: '甲科技股份有限公司', encodedCustNo: 'sub' },
    { name: '臺灣某某股份有限公司(某某)', encodedCustNo: 'exact' },
  ];
  assert.equal(pickCompany(results, '台灣某某股份有限公司').encodedCustNo, 'exact');
  assert.equal(pickCompany(results, '甲科技').encodedCustNo, 'sub');
  assert.equal(pickCompany(results, '不存在公司'), null);
  assert.equal(pickCompany(undefined, '甲'), null);
});

test('company job lists merge top and normal jobs into discovery rows', () => {
  const data = { data: { list: { topJobs: [{ jobNo: 'a1', jobName: '軟體經理', jobUrl: 'https://www.104.com.tw/job/a1', jobAddrNoDesc: '台北市內湖區', jobSalaryDesc: '待遇面議' }], normalJobs: [{ jobNo: 'b2', jobName: '研發主管', jobAddrNoDesc: '高雄市前鎮區' }] } } };
  const jobs = companyJobs(data, '例子股份有限公司');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, '例子股份有限公司');
  assert.equal(jobs[0].external_id, '104:a1');
  assert.equal(jobs[1].url, 'https://www.104.com.tw/job/b2');
  assert.deepEqual(companyJobs({}, 'x'), []);
});
