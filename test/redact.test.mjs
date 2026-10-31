import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRedact, findForbidden } from '../lib/redact.mjs';

const rules = {
  drop_lines: ['^- Confidential'],
  remove: [', with customers under NDA'],
  forbid: ['under NDA'],
};

test('drop_lines removes whole lines, remove cuts clauses, case-insensitive', () => {
  const md = '# Name\n- Shipped X, with customers under NDA\n- confidential pilot\n- Shipped Y';
  assert.equal(applyRedact(md, rules), '# Name\n- Shipped X\n- Shipped Y');
});
test('forbid reports what survives redaction', () => {
  assert.deepEqual(findForbidden(applyRedact('- one customer under NDA', rules), rules), ['under NDA']);
  assert.deepEqual(findForbidden(applyRedact('- Shipped X, with customers under NDA', rules), rules), []);
});
test('empty rules leave text unchanged', () => {
  assert.equal(applyRedact('a\r\nb', {}), 'a\nb');
  assert.deepEqual(findForbidden('anything', {}), []);
});
