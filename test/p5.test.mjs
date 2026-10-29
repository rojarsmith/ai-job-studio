import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFollowups, formatFollowups, dueFollowups } from '../lib/followups.mjs';
import { isoWeek, funnelBySource, responseByScore, rejectionReasons, suggestions, renderRetro } from '../lib/retro.mjs';

test('followups parse / format round trip and due calculation', () => {
  const text = '# Follow-ups\n\nintro\n\n## 008 · day 7 · GitLab — TPM\ncreated: 2026-11-05\nstatus: sent (2026-11-06)\napplied: 2026-10-29\n\n### Draft\n\nHello\n';
  const p = parseFollowups(text);
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].status, 'sent');
  assert.equal(p.items[0].status_note, '2026-11-06');
  assert.match(formatFollowups(p), /## 008 · day 7 · GitLab — TPM\ncreated: 2026-11-05\nstatus: sent \(2026-11-06\)/);
  const tracker = [
    { id: '008', status: 'submitted', applied: '2026-10-29' },
    { id: '009', status: 'rejected', applied: '2026-10-01' },
    { id: '010', status: 'screening', applied: '2026-10-20' },
  ];
  const due = dueFollowups(tracker, p.items, [7, 14], '2026-11-06');
  // 008 day 7 already exists, day 14 (11-12) not yet due; 009 is closed; 010 applied 10-20 → day 7 and 14 both due
  assert.deepEqual(due.map((d) => `${d.id}:${d.day}`), ['010:7', '010:14']);
});
test('isoWeek', () => {
  assert.equal(isoWeek(new Date(2026, 9, 29)), '2026-W44');
  assert.equal(isoWeek(new Date(2027, 0, 1)), '2026-W53');
});
test('funnel, score bands, rejection buckets, suggestions, render', () => {
  const pipeline = [
    { source: 'greenhouse', state: 'submitted', score: '4', report: '001-x.md' },
    { source: 'greenhouse', state: 'skip', score: '2', report: '002-x.md' },
    { source: 'greenhouse', state: 'scored', score: '3', report: '003-x.md' },
    { source: '104', state: 'rejected', score: '3', report: '004-x.md' },
    { source: '104', state: 'discovered', score: '', report: '' },
  ];
  const tracker = [
    { id: '001', channel: 'greenhouse', status: 'interview', applied: '2026-10-01', updated: '2026-10-10' },
    { id: '004', channel: '104', status: 'rejected', applied: '2026-10-02', updated: '2026-10-12' },
  ];
  const f = funnelBySource(pipeline, tracker);
  assert.equal(f.greenhouse.discovered, 3);
  assert.equal(f.greenhouse.submitted, 1);
  assert.equal(f.greenhouse.interview, 1);
  assert.equal(f.greenhouse.interview_rate, '100%');
  assert.equal(f['104'].rejected, 1);
  const b = responseByScore(pipeline, tracker);
  assert.equal(b[4].responded, 1);
  assert.equal(b[3].response_rate, '0%');
  const r = rejectionReasons([{ to: 'rejected', reason: 'needs US work authorization' }, { to: 'rejected', reason: '' }, { to: 'scored', reason: 'x' }]);
  assert.equal(r.total, 2); assert.equal(r.location, 1); assert.equal(r.no_reason, 1);
  const s = suggestions({ funnel: f, bands: b, sessions: [{ site: '104', last_verified: '2026-01-01', locked: '' }, { site: 'linkedin', locked: '2026-10-28T00:00:00Z' }], thresholds: { maybe_min: 3 }, now: Date.parse('2026-10-29') });
  assert.ok(s.some((x) => /104: session last verified/.test(x)));
  assert.ok(s.some((x) => /linkedin: LOCKED/.test(x)));
  const md = renderRetro({ week: '2026-W44', funnel: f, bands: b, reasons: r, scans: [{ date: '2026-10-29', source: 'greenhouse', found: '10', new: '10', duration_ms: '7' }], suggestions: s });
  assert.match(md, /# Retro 2026-W44/);
  assert.match(md, /\| greenhouse \| 3 \| 3 \| 1 \| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \| 33% \| 100% \| 100% \|/);
  assert.match(md, /## Decisions/);
});
