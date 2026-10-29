import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfile } from '../lib/profile.mjs';

test('native profile passes through with defaults', () => {
  const p = normalizeProfile({ name: 'A', email: 'a@b', target_titles: ['X'] });
  assert.equal(p.name, 'A');
  assert.deepEqual(p.deal_breakers, []);
  assert.equal(p._format, 'native');
});
test('career-ops profile is mapped to canonical keys', () => {
  const p = normalizeProfile({
    candidate: { full_name: 'W B', email: 'w@b.c', phone: '+886 9', location: 'Kaohsiung, Taiwan', github: 'github.com/w' },
    target_roles: { primary: ['Engineering Director', 'Software Manager'], archetypes: [{ name: 'PM', level: 'Manager and above' }] },
    compensation: { currency: 'TWD', minimum: 'TWD 100,000 monthly base', target_range: 'TWD 2.5M', location_flexibility: 'open to remote' },
    location: { authorized_in: ['Taiwan'], needs_sponsorship: true, visa_status: 'no US auth' },
    language: { output: 'en' }, cover_letter: { notice_period_days: 30 }, deal_breakers: ['leetcode'],
  });
  assert.equal(p.name, 'W B');
  assert.equal(p.website, 'github.com/w');
  assert.deepEqual(p.target_titles, ['Engineering Director', 'Software Manager']);
  assert.equal(p.seniority, 'director');
  assert.equal(p.remote_preference, 'any');
  assert.equal(p.salary.monthly_min, 100000);
  assert.equal(p.work_authorization.taiwan, 'citizen');
  assert.equal(p.work_authorization.other, 'needs_sponsorship');
  assert.deepEqual(p.languages, ['en', 'zh-TW']);
  assert.deepEqual(p.deal_breakers, ['leetcode']);
  assert.equal(p.notice_period_days, 30);
  assert.equal(p._format, 'career-ops');
});
