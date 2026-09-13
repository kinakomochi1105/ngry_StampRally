import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomHex, safeEqual, sign } from '../../lib/crypto.ts';

test('signing needs a long secret and follows a changed one', async () => {
  process.env.RALLY_SECRET = 'short';
  await assert.rejects(sign('x'), /not configured/);
  process.env.RALLY_SECRET = 'a'.repeat(32);
  const first = await sign('value');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(await sign('value'), first);
  process.env.RALLY_SECRET = 'b'.repeat(32);
  assert.notEqual(await sign('value'), first);
});

test('safeEqual compares whole strings', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.match(randomHex(16), /^[a-f0-9]{32}$/);
});
