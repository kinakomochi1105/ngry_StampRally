import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQr, stampPath } from '../../lib/qr.ts';

const signature = 'a'.repeat(64);
const event = 'festival-2026';

test('every printed shape of a code is understood', () => {
  const expected = { spotId: 'art', signature };
  for (const code of [
    stampPath('art', signature),
    `s/art/${signature}`,
    `/s/art/${signature}/`,
    `https://rally.example.jp/s/art/${signature}`,
    `http://192.168.0.2:3000/s/art/${signature}?utm=poster`,
    `rally:${event}:art:${signature}`,
  ])
    assert.deepEqual(parseQr(code, event), expected, code);
});

test('anything else is refused before a signature is computed', () => {
  for (const code of [
    `rally:other-festival:art:${signature}`,
    `rally:${event}:art`,
    '/s/../api/admin/spots',
    '/s/art',
    `/s/ART/${signature}`,
    `/s/art/${'A'.repeat(64)}`,
    `/s/art/${signature}0`,
    `/s/%E0%A4%A/${signature}`,
    'https://[bad',
    '',
  ])
    assert.equal(parseQr(code, event), null, code);
});
