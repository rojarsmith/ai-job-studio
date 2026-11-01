import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, parseSearchPage, parseDetailPage, jobUrl } from '../adapters/tsmc.mjs';
import { adapterForUrl } from '../adapters/index.mjs';

const article = (id, title, loc, area, type, posted) => `
<article class="article article--result" id="article--${id}">
  <div class="article__header"><div class="article__header__text">
    <h3 class="article__header__text__title title title--03"><a class="link" href="https://careers.example/en_US/careers/JobDetail?jobId=${id}&amp;source=External%2BCareer%2BSite">
      ${title}
    </a></h3>
    <div class="article__header__text__subtitle">
      <span class="list-item-location">${loc}</span><span class="separator"> | </span>
      <span class="list-item-careerArea">${area}</span><span class="separator"> | </span>
      <span class="list-item-employmentType">${type}</span>
    </div>
    <div class="article__header__text__subtitle"><span class="list-item-posted"> Posted: ${posted} </span></div>
  </div></div>
</article>`;

const SEARCH = `<html><body><div>25
   results</div>${article(101, 'Platform Engineering Manager', 'Taiwan', 'Information Technology', 'Regular', 'Sep 11, 2026')}
${article(102, 'Site &amp; Facility Lead', 'Japan-Osaka', 'Manufacturing (fabs)', 'Regular', 'Oct 02, 2026')}</body></html>`;

const field = (label, value) => `<div class="article__content__view__field divider--top--custom"><div class="article__content__view__field__label">${label}</div>
<div class="article__content__view__field__value">${value}</div></div>`;
const DETAIL = `<html><head><title>Platform Engineering Manager</title></head><body><h1>Platform Engineering Manager</h1>
<article class="article article--details">${field('Company', 'Example Corp')}${field('Location', 'Taiwan')}${field('Career Area', 'Information Technology')}
${field('Job Type', 'Manager / Executive')}${field('Posted', 'Sep 11, 2026')}
${field('Job Responsibilities', '<div>1. Lead the platform team.</div><div>2. Own reliability &amp; cost.</div>')}
${field('Job Qualifications', '<div>1. 10+ years of software engineering.</div>')}</article></body></html>`;

test('buildQuery maps names to ids, passes numbers through, always pages by 10', () => {
  const q = new URLSearchParams(buildQuery({ location: 'Taiwan', job_type: 'Manager / Executive', category: '38625', keyword: 'director' }, 20));
  assert.equal(q.get('1277'), '13209');
  assert.equal(q.get('147'), '5708');
  assert.equal(q.get('558'), '38625');
  assert.equal(q.get('search'), 'director');
  assert.equal(q.get('jobRecordsPerPage'), '10');
  assert.equal(q.get('jobOffset'), '20');
  assert.throws(() => buildQuery({ location: 'Atlantis' }), /unknown location/);
});

test('parseSearchPage reads total, ids, titles and the subtitle spans', () => {
  const { total, jobs } = parseSearchPage(SEARCH);
  assert.equal(total, 25);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], { id: '101', title: 'Platform Engineering Manager', location: 'Taiwan', category: 'Information Technology', employment: 'Regular', posted: '2026-09-11' });
  assert.equal(jobs[1].title, 'Site & Facility Lead');
  assert.equal(jobs[1].location, 'Japan-Osaka');
});

test('parseDetailPage uses the label/value fields, not JSON-LD, and rejects non-posting pages', () => {
  const d = parseDetailPage(DETAIL);
  assert.equal(d.title, 'Platform Engineering Manager');
  assert.match(d.responsibilities, /Lead the platform team\.\s+2\. Own reliability & cost\./);
  assert.match(d.qualifications, /10\+ years/);
  assert.equal(d.fields['Job Type'].trim(), 'Manager / Executive');
  assert.equal(parseDetailPage('<html><body>Sorry, this job is no longer available</body></html>'), null);
});

test('adapter routing and canonical url', () => {
  assert.equal(jobUrl(7), 'https://careers.tsmc.com/en_US/careers/JobDetail?jobId=7');
  assert.equal(adapterForUrl('https://careers.tsmc.com/en_US/careers/JobDetail?jobId=7&source=x')?.name, 'tsmc');
});
