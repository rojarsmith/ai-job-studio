import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePipeline, formatRow, writePipeline, readPipeline, transition } from '../lib/pipeline.mjs';
import { parseReport, buildReport, slug } from '../lib/report.mjs';
import { dealBreakerHit, decideAction, validateFront } from '../lib/scoring.mjs';
import { htmlToText } from '../lib/html.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-'));

test('pipeline round-trips rows and keeps header', () => {
  const text = '# Pipeline\n\nnotes\n\n- [ ] https://a/1 | Acme | Backend | greenhouse | 2026-10-29 | discovered | - | -\n- [x] https://a/2 | Acme | Old | 104 | 2026-10-01 | skip | 2 | 001-acme-old.md\n';
  const p = parsePipeline(text);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0].score, '');
  assert.equal(p.rows[1].report, '001-acme-old.md');
  const file = path.join(tmp, 'pipeline.md');
  writePipeline(p, file);
  const again = readPipeline(file);
  assert.deepEqual(again.rows, p.rows);
  assert.equal(again.header, '# Pipeline\n\nnotes');
  assert.match(formatRow({ url: 'u', company: 'A|B', title: 't', state: 'skip' }), /^- \[x\] u \| A｜B \| t/);
});
test('transition logs and refuses illegal moves', () => {
  const log = path.join(tmp, 'status-log.tsv');
  const row = { url: 'https://a/1', state: 'discovered' };
  transition(row, 'scored', 'score=4', log);
  assert.equal(row.state, 'scored');
  assert.match(fs.readFileSync(log, 'utf8'), /https:\/\/a\/1\tdiscovered\tscored\tscore=4/);
  assert.throws(() => transition(row, 'submitted', '', log), /illegal/);
});
test('report build/parse and slug', () => {
  const r = buildReport('007', { url: 'https://x/1', company: 'Acme 科技', title: 'Backend（Senior）**月薪**', source: '104', description: 'd', requirements: 'r', meta: { a: 1 } }, { found: '2026-10-29' });
  const text = `---\n${JSON.stringify(r.front)}\n---\n${r.body}`;
  const p = parseReport(text);
  assert.equal(p.front.score, null);
  assert.match(p.body, /## Requirements/);
  assert.equal(slug('Acme 科技'), 'Acme-科技');
  assert.equal(slug('Backend（Senior）**月薪40,000**'), 'Backend');
});
test('scoring helpers', () => {
  assert.equal(dealBreakerHit('We pay Commission Only', ['unpaid', 'commission only']), 'commission only');
  assert.equal(dealBreakerHit('fine', ['unpaid']), null);
  assert.equal(decideAction(4, { apply_min: 4, maybe_min: 3 }), 'apply');
  assert.equal(decideAction(3, { apply_min: 4, maybe_min: 3 }), 'maybe');
  assert.equal(decideAction(2, { apply_min: 4, maybe_min: 3 }), 'skip');
  assert.deepEqual(validateFront({ score: 1, deal_breaker: 'x', scored_by: 'deal-breaker' }), []);
  assert.ok(validateFront({ score: 4, scores: { skills: 4 } }).length > 0);
  assert.ok(validateFront({ score: 6 }).length > 0);
});
test('htmlToText decodes double-encoded greenhouse content', () => {
  const t = htmlToText('&lt;div&gt;&lt;h3&gt;About&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;one &amp;amp; two&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;');
  assert.equal(t, '### About\n\n- one & two');
});
