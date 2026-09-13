import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { participants } from '@/db/schema';
import { randomHex, safeEqual, sign } from './crypto';
import { event } from './event';
import { isSecureRequest, readCookie, UserError } from './http';

/** How long a participant cookie, and the stamps it shows, last. */
export const retentionSeconds = 30 * 24 * 60 * 60;

const cookieName = 'rally_pass';

/**
 * The participant this browser holds a pass for, as the hash stored in
 * `participants.hash`. The cookie carries a random id; the hash is derived
 * from it, so the database never holds what the browser sends. Returns null
 * for a missing, expired or forged cookie — not for one whose participant has
 * since been deleted or moved to another device (see `currentParticipant`).
 */
export async function participantHash(request: Request) {
  const cookie = readCookie(request, cookieName);
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  if (
    !/^[a-f0-9]{64}$/.test(id) ||
    !/^\d{10}$/.test(expires) ||
    Number(expires) <= Date.now() / 1000
  )
    return null;
  if (!safeEqual(signature, await sign(`session:${id}.${expires}`)))
    return null;
  return sign(`participant:${event.id}:${id}`);
}

export async function newParticipant(request: Request) {
  const id = randomHex(32);
  const expires = Math.floor(Date.now() / 1000) + retentionSeconds;
  const signature = await sign(`session:${id}.${expires}`);
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return {
    hash: await sign(`participant:${event.id}:${id}`),
    cookie: `${cookieName}=${id}.${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${retentionSeconds}${secure}`,
  };
}

export const clearParticipantCookie = (request: Request) =>
  `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isSecureRequest(request) ? '; Secure' : ''}`;

/** The registered participant behind this browser's pass, or null. */
export async function currentParticipant(request: Request) {
  const hash = await participantHash(request);
  if (!hash) return null;
  const row = await db()
    .select({
      id: participants.id,
      hash: participants.hash,
      nickname: participants.nickname,
      completedAt: participants.completedAt,
      redeemedAt: participants.redeemedAt,
    })
    .from(participants)
    .where(and(eq(participants.eventId, event.id), eq(participants.hash, hash)))
    .get();
  return row ?? null;
}

export async function requireParticipant(
  request: Request,
  message = '参加登録を行ってから操作してください。',
) {
  const person = await currentParticipant(request);
  if (!person) throw new UserError(message, 401);
  return person;
}
