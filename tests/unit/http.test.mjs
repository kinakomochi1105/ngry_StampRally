import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  bodyJson,
  clientAddress,
  isUniqueViolation,
  requireSameOrigin,
  route,
  UserError,
} from '../../lib/http.ts';

afterEach(() => {
  delete process.env.VERCEL;
});

const request = (headers = {}, url = 'http://localhost:3000/api/x', init) =>
  new Request(url, { headers, ...init });

test('forwarded client addresses are believed only on Vercel', () => {
  const spoofed = request({
    'x-forwarded-for': '203.0.113.9',
    'x-real-ip': '203.0.113.9',
  });
  assert.equal(clientAddress(spoofed), 'local');
  process.env.VERCEL = '1';
  assert.equal(clientAddress(spoofed), '203.0.113.9');
  assert.equal(
    clientAddress(request({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' })),
    '198.51.100.1',
  );
  // Cloudflare's header is no longer read at all.
  assert.equal(
    clientAddress(request({ 'cf-connecting-ip': '192.0.2.1' })),
    'unknown',
  );
});

test('a change sent from another site is refused', () => {
  // What a browser sends for a cross-site form or fetch: its own Origin, and
  // forwarded headers describing this server, which it cannot alter.
  for (const origin of ['https://attacker.invalid', 'null'])
    assert.throws(
      () =>
        requireSameOrigin(
          request({ origin, 'x-forwarded-host': 'localhost:3000' }),
        ),
      (error) => error.status === 403,
    );
  assert.throws(
    () => requireSameOrigin(request()),
    (e) => e.status === 403,
  );
  requireSameOrigin(request({ origin: 'http://localhost:3000' }));
  // Behind Vercel the public host arrives in the forwarded headers.
  requireSameOrigin(
    request(
      {
        origin: 'https://rally.example.jp',
        'x-forwarded-host': 'rally.example.jp',
        'x-forwarded-proto': 'https',
      },
      'http://127.0.0.1:3000/api/x',
    ),
  );
});

test('routes answer a UserError as it is and hide every other fault', async () => {
  const original = console.error;
  const logged = [];
  console.error = (line) => logged.push(line);
  try {
    const user = await route('scope', 'fallback', async () => {
      throw new UserError('合言葉を入力してください。', 401, {
        code: 'gate',
        headers: { 'Retry-After': '9' },
      });
    })(request(), undefined);
    assert.equal(user.status, 401);
    assert.equal(user.headers.get('retry-after'), '9');
    assert.deepEqual(await user.json(), {
      error: '合言葉を入力してください。',
      code: 'gate',
    });
    assert.equal(logged.length, 0);

    const fault = await route(
      'GET /api/x',
      '読み込めませんでした。',
      async () => {
        throw new Error('Failed query: select 1\nparams: secret-nickname', {
          cause: new Error('SQLITE_BUSY'),
        });
      },
    )(request(), undefined);
    assert.equal(fault.status, 503);
    assert.deepEqual(await fault.json(), { error: '読み込めませんでした。' });
    assert.equal(logged.length, 1);
    assert.match(logged[0], /GET \/api\/x/);
    assert.match(logged[0], /SQLITE_BUSY/);
    assert.doesNotMatch(logged[0], /secret-nickname/);
  } finally {
    console.error = original;
  }
});

test('unique violations are recognised through a wrapper', () => {
  const wrapped = new Error('Failed query', {
    cause: new Error(
      'SQLITE_CONSTRAINT: UNIQUE constraint failed: participants.hash',
    ),
  });
  assert.equal(isUniqueViolation(wrapped), true);
  assert.equal(isUniqueViolation(new Error('other')), false);
});

test('request bodies must be small JSON objects', async () => {
  const post = (body, type = 'application/json') =>
    request({ 'content-type': type }, 'http://localhost/api/x', {
      method: 'POST',
      body,
    });
  assert.deepEqual(await bodyJson(post('{"a":1}')), { a: 1 });
  for (const bad of [post('{"a":1}', 'text/plain'), post('[1]'), post('{bad')])
    await assert.rejects(bodyJson(bad), (error) => error.status === 400);
  await assert.rejects(
    bodyJson(post(JSON.stringify({ a: 'x'.repeat(100) })), 32),
    (error) => error.status === 413,
  );
});
