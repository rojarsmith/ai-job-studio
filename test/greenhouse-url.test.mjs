import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, parseJobUrl } from '../adapters/greenhouse.mjs';

test('custom career-site URLs become boards.greenhouse.io URLs that carry the board token', () => {
  const u = canonicalUrl('acme', { id: 42, absolute_url: 'https://acme.com/careers/job?gh_jid=42' });
  assert.deepEqual(parseJobUrl(u), { board: 'acme', id: '42' });
});

test('boards.greenhouse.io URLs are kept as they are', () => {
  const abs = 'https://boards.greenhouse.io/acme/jobs/7';
  assert.equal(canonicalUrl('acme', { id: 7, absolute_url: abs }), abs);
});
