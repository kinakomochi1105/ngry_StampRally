import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.RALLY_SECRET = 'unit-test-secret-'.padEnd(64, 'x');
const { checkRewardCode, issueRewardCode } =
  await import('../../lib/reward.ts');

const now = 1_800_000_000;

test('a fresh code is accepted for its pass', async () => {
  const { code, refreshAt } = await issueRewardCode(42, now);
  assert.match(code, /^\d{14}$/);
  assert.ok(refreshAt > now);
  assert.deepEqual(await checkRewardCode(code, now), { ok: true, id: 42 });
});

test('digits and spaces typed through an IME are normalised', async () => {
  const { code } = await issueRewardCode(7, now);
  const typed = code
    .replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)))
    .replace(/(.{4})/g, '$1 ');
  assert.deepEqual(await checkRewardCode(typed, now), { ok: true, id: 7 });
});

test('the check digits cannot be made up, nor moved to another pass', async () => {
  const { code } = await issueRewardCode(42, now);
  const forged =
    code.slice(0, -8) +
    String((Number(code.slice(-8)) + 1) % 1e8).padStart(8, '0');
  assert.equal((await checkRewardCode(forged, now)).ok, false);
  assert.equal(
    (await checkRewardCode('000043' + code.slice(-8), now)).ok,
    false,
  );
  for (const junk of ['', 'not a code', '0'.repeat(14), 1234, null])
    assert.deepEqual(await checkRewardCode(junk, now), {
      ok: false,
      reason: 'invalid',
    });
});

test('a code expires after its windows, and is then reported as expired', async () => {
  const { code } = await issueRewardCode(42, now);
  assert.equal((await checkRewardCode(code, now + 300)).ok, true);
  assert.deepEqual(await checkRewardCode(code, now + 20 * 60), {
    ok: false,
    reason: 'expired',
  });
  assert.deepEqual(await checkRewardCode(code, now + 24 * 3600), {
    ok: false,
    reason: 'invalid',
  });
});

test('long pass ids still pack into an even number of digits', async () => {
  const { code } = await issueRewardCode(1234567, now);
  assert.equal(code.length % 2, 0);
  assert.deepEqual(await checkRewardCode(code, now), {
    ok: true,
    id: 1234567,
  });
});
