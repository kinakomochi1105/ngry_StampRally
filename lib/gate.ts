import { safeEqual, sign } from './crypto';
import { event } from './event';
import {
  clientAddress,
  isSecureRequest,
  nowSeconds,
  readCookie,
  UserError,
} from './http';
import { forgetStatement, limitKey, limits, enforce } from './limits';
import { retentionSeconds } from './session';
import { hashSecret, secretHash } from './settings';

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

async function gateCookie(request: Request, passwordHash: string) {
  const expires = nowSeconds() + retentionSeconds;
  const signature = await sign(`gate:${event.id}:${expires}:${passwordHash}`);
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${cookieName}=${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${retentionSeconds}${secure}`;
}

async function hasPass(request: Request, passwordHash: string) {
  const value = readCookie(request, cookieName);
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
 * Throws the one 401 the participant screen reads as "ask for the word"
 * (`code: 'gate'`) rather than "sign in again", unless the visitor may pass.
 */
export async function requireGate(request: Request) {
  const expected = await secretHash('site-password');
  if (!expected || (await hasPass(request, expected))) return;
  throw new UserError('合言葉を入力してください。', 401, { code: 'gate' });
}

/** Whether a word is set at all, for the screen that has to ask for it. */
export const gateRequired = async () =>
  (await secretHash('site-password')) !== null;

/**
 * Checks a submitted word and returns the pass cookie, or null when no word
 * is set. Attempts are counted per connection, so a shared venue line still
 * allows a whole class to type a word they were told.
 */
export async function openGate(request: Request, password: unknown) {
  const expected = await secretHash('site-password');
  if (!expected) return null;
  const bucket = await limitKey('gate', clientAddress(request));
  await enforce(bucket, limits.gate);
  if (
    typeof password !== 'string' ||
    !safeEqual(await hashSecret('site-password', password), expected)
  )
    throw new UserError('合言葉が違います。掲示や案内をご確認ください。', 401);
  await forgetStatement(bucket);
  return gateCookie(request, expected);
}
