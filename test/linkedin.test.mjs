import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchHtml, parseDetailHtml, jobIdOf, apply_url } from '../adapters/linkedin.mjs';
import { adapterForUrl } from '../adapters/index.mjs';

const fx = (f) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', f), 'utf8');

test('parse guest search cards', () => {
  const jobs = parseSearchHtml(fx('linkedin-search.html'));
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], { url: 'https://www.linkedin.com/jobs/view/4312345678/', company: 'Acme & Co', title: 'Engineering Manager', source: 'linkedin', location: 'Taipei City, Taiwan', posted: '2026-10-27', external_id: 'linkedin:4312345678' });
  assert.equal(jobs[1].company, 'Beta Ltd');
});
test('parse guest detail page', () => {
  const d = parseDetailHtml(fx('linkedin-detail.html'), '4312345678');
  assert.equal(d.title, 'Engineering Manager');
  assert.equal(d.company, 'Acme & Co');
  assert.equal(d.location, 'Taipei City, Taiwan');
  assert.match(d.description, /Engineering Manager to lead a team of 8/);
  assert.match(d.description, /- Lead hiring and growth/);
  assert.match(d.requirements, /Seniority level: Director/);
  assert.equal(d.meta['Employment type'], 'Full-time');
  assert.equal(d.meta.easy_apply_hint, false);
});
test('job id and apply url', () => {
  assert.equal(jobIdOf('https://tw.linkedin.com/jobs/view/engineering-manager-at-acme-4312345678?x=1'), '4312345678');
  assert.equal(jobIdOf('https://www.linkedin.com/jobs/search/?currentJobId=4399999999'), '4399999999');
  assert.equal(apply_url({ url: 'https://www.linkedin.com/jobs/view/4312345678/' }), 'https://www.linkedin.com/jobs/view/4312345678/');
  assert.equal(adapterForUrl('https://www.linkedin.com/jobs/view/1/').name, 'linkedin');
});
