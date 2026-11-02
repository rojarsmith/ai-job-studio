import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildListUrl, parseJobPosting, toJob, jobIdOf, search, detail } from '../adapters/yourator.mjs';
import { adapterForUrl } from '../adapters/index.mjs';

const page = (ld) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;
const POSTING = { '@type': 'JobPosting', title: 'Engineering Manager', description: '<p>Lead the <b>platform</b> team.</p>', identifier: 'x', datePosted: '2026-11-02 02:00:11 +0800', employmentType: 'FULL_TIME', hiringOrganization: { name: 'Example Co' }, jobLocation: { address: { addressRegion: '臺北市', addressLocality: '臺北市' } } };

test('list URL carries term, page and sort; extra params become arrays', () => {
  const u = new URL(buildListUrl('經理', 2, { area: ['Taipei'] }));
  assert.equal(u.searchParams.get('term[]'), '經理');
  assert.equal(u.searchParams.get('page'), '2');
  assert.equal(u.searchParams.get('sort'), 'recent_updated');
  assert.equal(u.searchParams.get('area[]'), 'Taipei');
});

test('list rows map to jobs with absolute URLs and the numeric id', () => {
  const j = toJob({ id: 7, name: 'EM', path: '/companies/acme/jobs/7', location: '臺北市', salary: '面議', company: { brand: 'Acme' } });
  assert.equal(j.url, 'https://www.yourator.co/companies/acme/jobs/7');
  assert.equal(j.company, 'Acme');
  assert.equal(j.external_id, '7');
  assert.equal(jobIdOf(j.url), '7');
});

test('JobPosting is read from JSON-LD and other blocks are ignored', () => {
  const html = `<script type="application/ld+json">{"@type":"Organization"}</script>${page(POSTING)}`;
  assert.equal(parseJobPosting(html).title, 'Engineering Manager');
  assert.equal(parseJobPosting('<html></html>'), null);
});

test('adapterForUrl routes yourator.co', () => {
  assert.equal(adapterForUrl('https://www.yourator.co/companies/acme/jobs/7').name, 'yourator');
});

test('search pages through hasMore, filters by location and de-duplicates across keywords', async () => {
  const rows = (ids, loc) => ids.map((id) => ({ id, name: `Role ${id}`, path: `/companies/a/jobs/${id}`, location: loc, company: { brand: 'A' } }));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const q = new URL(u).searchParams;
    const p = Number(q.get('page'));
    const body = p === 1 ? { payload: { hasMore: true, jobs: [...rows([1, 2], '臺北市'), ...rows([3], '台中市')] } } : { payload: { hasMore: false, jobs: rows([1, 4], '高雄市') } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const out = await search({ keywords: ['a', 'b'], locations: ['臺北', '高雄'], max_pages: 3 });
    assert.deepEqual(out.map((j) => j.external_id).sort(), ['1', '2', '4']);
  } finally { globalThis.fetch = realFetch; }
});

test('detail returns text and posted date, and null on 404', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).endsWith('/7') ? new Response(page(POSTING), { status: 200 }) : new Response('nope', { status: 404 }));
  try {
    const d = await detail('https://www.yourator.co/companies/acme/jobs/7');
    assert.equal(d.title, 'Engineering Manager');
    assert.equal(d.posted, '2026-11-02');
    assert.equal(d.location, '臺北市');
    assert.match(d.description, /Lead the platform team/);
    assert.equal(await detail('https://www.yourator.co/companies/acme/jobs/8'), null);
  } finally { globalThis.fetch = realFetch; }
});
