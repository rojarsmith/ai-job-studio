import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJobUrl, locationOf, apply_url, search } from '../adapters/ashby.mjs';
import { adapterForUrl } from '../adapters/index.mjs';

const ID = '3b5d54ca-741b-45ac-bd3f-31605a0d3541';

test('job URLs yield board and lower-case id, with or without /application', () => {
  assert.deepEqual(parseJobUrl(`https://jobs.ashbyhq.com/acme/${ID.toUpperCase()}`), { board: 'acme', id: ID });
  assert.deepEqual(parseJobUrl(`https://jobs.ashbyhq.com/acme/${ID}/application?x=1`), { board: 'acme', id: ID });
  assert.equal(parseJobUrl('https://example.com/acme/1'), null);
});

test('adapterForUrl routes Ashby URLs and apply_url points at the form', () => {
  const url = `https://jobs.ashbyhq.com/acme/${ID}`;
  assert.equal(adapterForUrl(url).name, 'ashby');
  assert.equal(apply_url({ url }), `${url}/application`);
});

test('locationOf joins primary, secondary and remote flag', () => {
  assert.equal(locationOf({ location: 'Remote, Global', secondaryLocations: [] }), 'Remote, Global');
  assert.equal(locationOf({ location: 'Berlin', secondaryLocations: [{ location: 'Taipei' }], isRemote: true }), 'Berlin; Taipei; Remote');
});

test('search keeps postings whose title and any location match, skips unlisted ones and missing boards', async () => {
  const jobs = [
    { id: ID, title: 'Engineering Manager, Platform', location: 'Remote, Global', secondaryLocations: [], jobUrl: `https://jobs.ashbyhq.com/acme/${ID}`, publishedAt: '2026-10-01T00:00:00Z', compensation: { compensationTierSummary: 'USD 150K - 200K' } },
    { id: '11111111-1111-1111-1111-111111111111', title: 'Engineering Manager, Platform', location: 'New York', secondaryLocations: [], jobUrl: 'https://jobs.ashbyhq.com/acme/11111111-1111-1111-1111-111111111111' },
    { id: '22222222-2222-2222-2222-222222222222', title: 'Engineering Manager, Platform', location: 'Remote, Global', isListed: false, jobUrl: 'https://jobs.ashbyhq.com/acme/22222222-2222-2222-2222-222222222222' },
    { id: '33333333-3333-3333-3333-333333333333', title: 'Account Executive', location: 'Remote, Global', jobUrl: 'https://jobs.ashbyhq.com/acme/33333333-3333-3333-3333-333333333333' },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => String(u).includes('/acme')
    ? new Response(JSON.stringify({ jobs }), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response('not found', { status: 404 });
  try {
    const out = await search({ boards: ['acme', 'nope'], keywords: ['manager'], locations: ['global', 'taiwan'] });
    assert.equal(out.length, 1);
    assert.equal(out[0].external_id, `acme:${ID}`);
    assert.equal(out[0].salary, 'USD 150K - 200K');
    assert.equal(out[0].posted, '2026-10-01');
  } finally { globalThis.fetch = realFetch; }
});
