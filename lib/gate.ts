import { database } from '@/db';
import { event } from './event';
import { hashSitePassword, sitePasswordHash } from './data';
import {
  clientAddress,
  isSecureRequest,
  json,
  retentionSeconds,
  safeEqual,
  sign,
} from './server';

/**
 * The site-wide access word.
 *
 * When an organiser sets one, the participant APIs answer nothing until the
 * visitor has typed it. The organiser console is deliberately outside this
 * gate: a mistyped word must never be able to lock the person who can clear it
 * out of the settings screen.
 *
 * The pass is a signed cookie rather than a stored session, and the signature
 * covers the current password hash, so changing or clearing the word
 * invalidates every pass that was handed out under the old one.
 */

const cookieName = 'rally_gate';

export async function gateCookie(request: Request, passwordHash: string) {
  const expires = Math.floor(Date.now() / 1000) + retentionSeconds;
  const signature = await sign(`gate:${event.id}:${expires}:${passwordHash}`);
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${cookieName}=${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${retentionSeconds}${secure}`;
}

/** Clears the pass, so a changed word takes effect on the next request. */
export function clearGateCookie(request: Request) {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

async function hasPass(request: Request, passwordHash: string) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1);
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!/^\d{10}$/.test(expires ?? '') || Number(expires) <= Date.now() / 1000)
    return false;
  return safeEqual(
    signature ?? '',
    await sign(`gate:${event.id}:${expires}:${passwordHash}`),
  );
}

/**
 * Returns a response to send back when the visitor may not pass, or null when
 * they may. `code: 'gate'` is what the participant screen watches for: it is
 * the one 401 that means "ask for the word", not "sign in again".
 */
export async function gate(request: Request) {
  const expected = await sitePasswordHash();
  if (!expected) return null;
  if (await hasPass(request, expected)) return null;
  return json({ error: '合言葉を入力してください。', code: 'gate' }, 401);
}

/** Whether a word is set at all, for the screen that has to ask for it. */
export const gateRequired = async () => (await sitePasswordHash()) !== null;

/**
 * Checks a submitted word. Attempts are counted per connection, the same way
 * the organiser login is, so a shared venue line still allows a whole class to
 * type a word they were told.
 */
export async function openGate(request: Request, password: unknown) {
  const expected = await sitePasswordHash();
  if (!expected)
    return { ok: true as const, cookie: null, error: null, status: 200 };

  const now = Math.floor(Date.now() / 1000);
  const bucket = await sign('gate-ip:' + clientAddress(request));
  const attempt = await database()
    .prepare(
      'INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts',
    )
    .bind(bucket, now + 900, now, now, now + 900)
    .first<{ attempts: number }>();
  if ((attempt?.attempts ?? 99) > 60)
    return {
      ok: false as const,
      cookie: null,
      error: '試行回数が多いため、15分後にお試しください。',
      status: 429,
    };

  if (
    typeof password !== 'string' ||
    !safeEqual(await hashSitePassword(password), expected)
  )
    return {
      ok: false as const,
      cookie: null,
      error: '合言葉が違います。掲示や案内をご確認ください。',
      status: 401,
    };

  await database()
    .prepare('DELETE FROM login_attempts WHERE key=? OR expires_at<=?')
    .bind(bucket, now)
    .run();
  return {
    ok: true as const,
    cookie: await gateCookie(request, expected),
    error: null,
    status: 200,
  };
}
