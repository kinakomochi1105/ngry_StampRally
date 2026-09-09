import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spots, event } from '../lib/event.ts';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('This test writes sample data; use a local server only.');
const secret = process.env.RALLY_SECRET;
if (!secret) throw new Error('RALLY_SECRET required');
const qr = (id) =>
  `rally:${event.id}:${id}:${createHmac('sha256', secret).update(`qr:${event.id}:${id}`).digest('hex')}`;
async function passport(cookie) {
  const r = await fetch(base + '/api/passport', {
    headers: cookie ? { cookie } : {},
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  return {
    cookie: r.headers.get('set-cookie')?.split(';')[0] || cookie,
    data: await r.json(),
  };
}
async function stamp(cookie, code, origin = base) {
  return fetch(base + '/api/stamp', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json', origin },
    body: JSON.stringify({ code }),
  });
}
const a = await passport();
const b = await passport();
assert.match(a.cookie, /rally_pass=/);
assert.notEqual(a.cookie, b.cookie);
assert.deepEqual(a.data.stamps, []);
let r = await stamp(a.cookie, qr(spots[0].id));
assert.equal(r.status, 200);
assert.equal((await r.json()).duplicate, false);
const repeated = await Promise.all(
  Array.from({ length: 24 }, () => stamp(a.cookie, qr(spots[0].id))),
);
for (const result of repeated) {
  assert.equal(result.status, 200);
  assert.equal((await result.json()).duplicate, true);
}
assert.equal((await passport(a.cookie)).data.stamps.length, 1);
assert.equal((await passport(b.cookie)).data.stamps.length, 0);
assert.equal(
  (await stamp(a.cookie, 'rally:festival-2026:art:fake')).status,
  400,
);
assert.equal(
  (await stamp(a.cookie, qr(spots[1].id), 'https://untrusted.example')).status,
  403,
);
assert.equal((await stamp('rally_pass=forged', qr(spots[1].id))).status, 401);
assert.equal((await stamp(a.cookie, 'x'.repeat(3000))).status, 413);
r = await fetch(base + '/api/stamp', {
  method: 'POST',
  headers: {
    cookie: a.cookie,
    origin: base,
    'Content-Type': 'application/json',
  },
  body: '{',
});
assert.equal(r.status, 400);
for (const spot of spots.slice(1))
  assert.equal((await stamp(a.cookie, qr(spot.id))).status, 200);
assert.equal((await passport(a.cookie)).data.stamps.length, spots.length);
console.log(
  'PASS: anonymous isolation, history restore, 24 concurrent duplicate scans, invalid QR, cross-origin request, forged cookie, oversized body, malformed JSON, completion.',
);
