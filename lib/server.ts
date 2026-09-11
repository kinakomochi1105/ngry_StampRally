import { env } from './env';
import { event } from './event';
import { database } from '@/db';
const encoder = new TextEncoder();
export const retentionSeconds = 30 * 24 * 60 * 60;
export async function sign(value: string) {
  if (!env.RALLY_SECRET || env.RALLY_SECRET.length < 32)
    throw new Error('Rally secret is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.RALLY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function participant(request: Request) {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('rally_pass='))
    ?.slice(11);
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
  const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const expires = Math.floor(Date.now() / 1000) + retentionSeconds;
  const signature = await sign(`session:${id}.${expires}`);
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return {
    hash: await sign(`participant:${event.id}:${id}`),
    cookie: `rally_pass=${id}.${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${retentionSeconds}${secure}`,
  };
}
export async function verifyQr(code: unknown) {
  if (typeof code !== 'string' || code.length > 512) return null;
  const parts = code.trim().split(':');
  if (parts.length !== 4) return null;
  const [prefix, eventId, spotId, signature] = parts;
  if (
    prefix !== 'rally' ||
    eventId !== event.id ||
    !/^[a-z0-9-]{1,64}$/.test(spotId)
  )
    return null;
  if (!safeEqual(signature, await sign(`qr:${eventId}:${spotId}`))) return null;
  if (
    !(await database()
      .prepare(
        'SELECT id FROM locations WHERE id=? AND event_id=? AND active=1',
      )
      .bind(spotId, event.id)
      .first())
  )
    return null;
  return spotId;
}
/**
 * API routes deliberately return friendly Japanese messages instead of raw
 * errors, which means a real fault (database down, bad migration) would other-
 * wise leave no trace at all. This puts the cause on the server console while
 * keeping the participant-facing response unchanged.
 */
export function logFailure(scope: string, error: unknown) {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(
    `${String.fromCharCode(27)}[31m✗ API ${scope}${String.fromCharCode(27)}[0m ${new Date().toISOString()}\n${detail}`,
  );
}
export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}
/**
 * Behind Cloudflare Tunnel the browser speaks HTTPS to the edge while
 * cloudflared forwards plain HTTP to this process, so `request.url` reports
 * the wrong scheme (and sometimes the wrong host). These helpers prefer the
 * forwarded headers, which is safe here because cloudflared dials out and the
 * origin is never directly reachable from the internet.
 */
const forwarded = (request: Request, name: string) =>
  request.headers.get(name)?.split(',')[0]?.trim() || '';

/**
 * Bucket key for the login and recovery rate limits. Vercel sets
 * `x-forwarded-for` on every request; Cloudflare Tunnel, still used to expose a
 * laptop at a venue, sets `cf-connecting-ip`. Neither header is trustworthy if
 * the process is reachable directly, which is why a LAN dev server simply
 * shares one bucket.
 */
export const clientAddress = (request: Request) =>
  forwarded(request, 'x-forwarded-for') ||
  request.headers.get('cf-connecting-ip')?.trim() ||
  'local';

export function isSecureRequest(request: Request) {
  if (forwarded(request, 'x-forwarded-proto') === 'https') return true;
  // Cloudflare also reports the visitor scheme as {"scheme":"https"}.
  if (/"scheme"\s*:\s*"https"/.test(request.headers.get('cf-visitor') ?? ''))
    return true;
  return new URL(request.url).protocol === 'https:';
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = forwarded(request, 'x-forwarded-host') || url.host;
  return `${isSecureRequest(request) ? 'https' : 'http'}://${host}`;
}

export function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return (
    origin === requestOrigin(request) || origin === new URL(request.url).origin
  );
}
