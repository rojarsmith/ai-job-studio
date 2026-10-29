import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, TRANSITIONS, assertTransition, canTransition, isTerminal } from '../lib/state.mjs';

test('every transition target is a known state', () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(STATES.includes(from), from);
    for (const to of tos) assert.ok(STATES.includes(to), `${from} → ${to}`);
  }
});
test('happy path discovered → submitted → offer', () => {
  const path = ['discovered', 'scored', 'tailored', 'prepared', 'filled', 'submitted', 'screening', 'interview', 'offer'];
  for (let i = 1; i < path.length; i++) assert.equal(assertTransition(path[i - 1], path[i]), path[i]);
});
test('no automatic submit path and no re-opening terminal states', () => {
  assert.equal(canTransition('prepared', 'submitted'), false);
  assert.equal(canTransition('skip', 'scored'), false);
  assert.equal(canTransition('rejected', 'interview'), false);
  assert.throws(() => assertTransition('discovered', 'tailored'), /illegal/);
  assert.throws(() => assertTransition('nope', 'scored'), /unknown/);
});
test('needs_human is reachable from every pre-submit state and returns to them', () => {
  for (const s of ['discovered', 'scored', 'tailored', 'prepared', 'filled']) {
    assert.ok(canTransition(s, 'needs_human'), s);
    assert.ok(canTransition('needs_human', s), `back to ${s}`);
  }
  assert.ok(isTerminal('skip') && isTerminal('offer') && !isTerminal('scored'));
});
