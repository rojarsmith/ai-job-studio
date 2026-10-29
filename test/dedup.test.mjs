import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, similarity, isDuplicate } from '../lib/dedup.mjs';
import { blacklistReason } from '../lib/blacklist.mjs';

test('normalizeUrl strips tracking params, www, trailing slash, hash', () => {
  assert.equal(normalizeUrl('https://www.104.com.tw/job/74vmq/?jobsource=index_s&utm_x=1#top'), 'https://104.com.tw/job/74vmq');
  assert.equal(normalizeUrl('https://boards.greenhouse.io/x/jobs/1?gh_jid=1&gh_src=abc'), 'https://boards.greenhouse.io/x/jobs/1?gh_jid=1');
});
test('similarity ignores salary noise and case', () => {
  assert.ok(similarity('後端工程師（Junior）**月薪40,000~65,000**', '後端工程師 (junior)') > 0.9);
  assert.ok(similarity('Backend Engineer', 'Frontend Engineer') < 0.9);
});
test('isDuplicate by url or by company+title', () => {
  const existing = [{ url: 'https://boards.greenhouse.io/acme/jobs/7', company: 'Acme', title: 'Backend Engineer' }];
  assert.ok(isDuplicate({ url: 'https://boards.greenhouse.io/acme/jobs/7?gh_src=zz', company: 'Other', title: 'x' }, existing));
  assert.ok(isDuplicate({ url: 'https://104.com.tw/job/abc', company: 'ACME', title: 'Backend engineer' }, existing));
  assert.equal(isDuplicate({ url: 'https://104.com.tw/job/abc', company: 'Acme', title: 'Data Scientist' }, existing), null);
});
test('blacklist by company, title regex, url fragment', () => {
  const bl = { companies: ['Bad Co'], title_patterns: ['intern(ship)?\\b', '實習'], url_contains: ['agency.example'] };
  assert.equal(blacklistReason({ company: 'bad co', title: 'Dev' }, bl), 'company:Bad Co');
  assert.match(blacklistReason({ company: 'X', title: 'Software Intern' }, bl), /^title:/);
  assert.match(blacklistReason({ company: 'X', title: '後端實習生' }, bl), /^title:/);
  assert.match(blacklistReason({ company: 'X', title: 'Dev', url: 'https://agency.example/j/1' }, bl), /^url:/);
  assert.equal(blacklistReason({ company: 'X', title: 'Internal Tools Engineer' }, bl), null);
});
