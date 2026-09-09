import { env } from 'cloudflare:workers';
import { event, spots } from './event';
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
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
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
    !spots.some((s) => s.id === spotId)
  )
    return null;
  return safeEqual(signature, await sign(`qr:${eventId}:${spotId}`))
    ? spotId
    : null;
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
export function validOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
