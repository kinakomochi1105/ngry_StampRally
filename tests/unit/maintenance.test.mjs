import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acceptedLanguages,
  maintenanceMessage,
  maintenanceResponse,
} from '../../lib/maintenance.ts';

const request = (path, headers = {}, init) =>
  new Request('http://localhost:3000' + path, { headers, ...init });

test('Accept-Language is read in order of preference', () => {
  assert.deepEqual(acceptedLanguages(null), []);
  assert.deepEqual(acceptedLanguages('en-US,en;q=0.9,ja;q=0.8'), [
    'en-US',
    'en',
    'ja',
  ]);
  // A lower weight written first still comes later; q=0 and * are dropped.
  assert.deepEqual(acceptedLanguages('en;q=0.2, ja, fr;q=0, *;q=0.1'), [
    'ja',
    'en',
  ]);
});

test('an API call gets the maintenance message as JSON', async () => {
  const response = maintenanceResponse(request('/api/register'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.deepEqual(await response.json(), {
    error: maintenanceMessage,
    code: 'maintenance',
  });
});

test('a page gets a 503 document in the preferred language', async () => {
  const japanese = maintenanceResponse(request('/'));
  assert.equal(japanese.status, 503);
  assert.match(japanese.headers.get('content-type'), /^text\/html/);
  const ja = await japanese.text();
  assert.match(ja, /<html lang="ja">/);
  assert.match(ja, /<div class="copy" lang="ja">/);
  assert.match(ja, /<div class="copy" lang="en" hidden>/);

  const en = await maintenanceResponse(
    request('/s/spot/code', { 'accept-language': 'en-GB,en;q=0.8' }),
  ).text();
  assert.match(en, /<html lang="en">/);
  assert.match(en, /<div class="copy" lang="ja" hidden>/);
});

test('a HEAD request gets the status without a body', async () => {
  const response = maintenanceResponse(request('/', {}, { method: 'HEAD' }));
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '');
});
