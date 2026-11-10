import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverHedges, atsCheck } from '../lib/ats.mjs';

test('coverHedges finds volunteered gaps in English and Chinese', () => {
  assert.deepEqual(coverHedges('To be candid, I do not yet have eight years of experience.'), ['To be candid', 'I do not yet have']);
  assert.ok(coverHedges('坦白說，貴公司要求五年管理經驗，我尚未長期管理大型部門。').length >= 2);
  assert.ok(coverHedges('雖然我沒有 Kubernetes 經驗').length);
  assert.ok(coverHedges('我的管理經驗較少').length);
});
test('coverHedges leaves plain evidence alone', () => {
  assert.deepEqual(coverHedges('I led a team of five and shipped the billing service to two regions.'), []);
  assert.deepEqual(coverHedges('我主導報表系統改版，產品尚未上市前即完成自動化測試。'), []);
  assert.deepEqual(coverHedges('I have led three platform migrations.'), []);
});
test('atsCheck fails a cover letter that hedges', () => {
  const md = '# Ada Example\n\nada@example.com\n\nDear team,\n\nTo be candid, I lack Kafka.\n';
  assert.ok(atsCheck(md, { kind: 'cover' }).problems.some((p) => p.startsWith('volunteers a gap')));
});
