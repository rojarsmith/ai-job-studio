import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkToSubmitted } from '../lib/submitted.mjs';

const recorder = () => { const log = []; return { log, transition: (row, to, why) => { log.push(`${row.state}>${to}:${why}`); row.state = to; return row; } }; };

test('a scored row is walked through every state to submitted', () => {
  const { log, transition } = recorder();
  const row = walkToSubmitted({ state: 'scored' }, transition, 'by hand');
  assert.equal(row.state, 'submitted');
  assert.deepEqual(log.map((l) => l.split(':')[0]), ['scored>tailored', 'tailored>prepared', 'prepared>filled', 'filled>submitted']);
});
test('a row already part-way continues from there; submitted stays', () => {
  const r = recorder();
  assert.equal(walkToSubmitted({ state: 'filled' }, r.transition).state, 'submitted');
  assert.equal(r.log.length, 1);
  assert.equal(walkToSubmitted({ state: 'submitted' }, r.transition).state, 'submitted');
  assert.equal(r.log.length, 1);
});
test('skipped or discovered rows cannot be recorded as submitted', () => {
  assert.throws(() => walkToSubmitted({ state: 'skip' }, recorder().transition), /cannot record/);
  assert.throws(() => walkToSubmitted({ state: 'discovered' }, recorder().transition), /cannot record/);
});
