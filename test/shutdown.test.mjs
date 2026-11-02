import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onShutdown, shutdown } from '../lib/shutdown.mjs';

test('closers run once, last registered first, and a failing closer does not stop the rest', async () => {
  const order = [];
  onShutdown(() => { order.push('first'); });
  onShutdown(() => { throw new Error('tab already gone'); });
  onShutdown(async () => { order.push('last'); });
  await shutdown();
  assert.deepEqual(order, ['last', 'first']);
  await shutdown();
  assert.deepEqual(order, ['last', 'first']);
});
