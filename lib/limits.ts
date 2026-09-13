import { and, eq, gt, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { loginAttempts } from '@/db/schema';
import { sign } from './crypto';
import { nowSeconds, UserError } from './http';

/**
 * Attempt counters, kept in `login_attempts`. Keys are HMACs of what they
 * count (a connection, a participant, a code), so no address or identifier is
 * stored in the clear.
 */

/** Every limit in one place, so the trade-offs can be read side by side. */
export const limits = {
  /** Organiser and desk sign-in, per connection. */
  adminLogin: { max: 20, window: 900 },
  /** The site's access word, per connection: a whole class shares one line. */
  gate: { max: 60, window: 900 },
  /** New passes, per connection. Generous for a school line, fatal for a script. */
  register: { max: 200, window: 900 },
  /** Recovery sign-in, per connection and per code. */
  recoveryAddress: { max: 100, window: 900 },
  recoveryCode: { max: 10, window: 900 },
  /** Crowd reports, per connection. The per-spot hold-off is lib/crowd.ts. */
  reportAddress: { max: 300, window: 900 },
  /** Wrong staff PINs, per participant and per connection. */
  staffPinParticipant: { max: 8, window: 900 },
  staffPinAddress: { max: 30, window: 900 },
} as const;

export const limitKey = (...parts: (string | number)[]) =>
  sign('limit:' + parts.join(':'));

/**
 * Adds one to the counter and returns the new count. A counter whose window
 * has run out starts again at one.
 */
export function countStatement(
  key: string,
  windowSeconds: number,
  now: number,
) {
  const expired = sql`${loginAttempts.expiresAt} <= ${now}`;
  return db()
    .insert(loginAttempts)
    .values({ key, attempts: 1, expiresAt: now + windowSeconds })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        attempts: sql`CASE WHEN ${expired} THEN 1 ELSE ${loginAttempts.attempts} + 1 END`,
        expiresAt: sql`CASE WHEN ${expired} THEN ${now + windowSeconds} ELSE ${loginAttempts.expiresAt} END`,
      },
    })
    .returning({ attempts: loginAttempts.attempts });
}

export async function hit(
  key: string,
  windowSeconds: number,
  now = nowSeconds(),
) {
  const [row] = await countStatement(key, windowSeconds, now);
  return row?.attempts ?? Number.POSITIVE_INFINITY;
}

/** The current count, without adding to it. */
export async function peek(key: string, now = nowSeconds()) {
  const row = await db()
    .select({ attempts: loginAttempts.attempts })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.expiresAt, now)))
    .get();
  return row?.attempts ?? 0;
}

/** Clears one counter, and any other that has already run out. */
export const forgetStatement = (key: string, now = nowSeconds()) =>
  db()
    .delete(loginAttempts)
    .where(or(eq(loginAttempts.key, key), lte(loginAttempts.expiresAt, now)));

/** Clears every counter that has run out. */
export const purgeExpiredStatement = (now = nowSeconds()) =>
  db().delete(loginAttempts).where(lte(loginAttempts.expiresAt, now));

/** Takes back one attempt, for an attempt that turned out to be legitimate. */
export const refundStatement = (key: string) =>
  db()
    .update(loginAttempts)
    .set({ attempts: sql`MAX(0, ${loginAttempts.attempts} - 1)` })
    .where(eq(loginAttempts.key, key));

export const tooMany = (
  windowSeconds = 900,
  message = '試行回数が多いため、15分後にお試しください。',
) =>
  new UserError(message, 429, {
    headers: { 'Retry-After': String(windowSeconds) },
  });

/** Counts one attempt and refuses it once the limit is passed. */
export async function enforce(
  key: string,
  limit: { max: number; window: number },
  message?: string,
) {
  if ((await hit(key, limit.window)) > limit.max)
    throw tooMany(limit.window, message);
}
