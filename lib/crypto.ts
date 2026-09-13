import { env } from './env';

const encoder = new TextEncoder();

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const randomHex = (byteLength: number) =>
  toHex(crypto.getRandomValues(new Uint8Array(byteLength)));

// A request signs several values (cookie, participant hash, gate pass), so the
// imported key is kept rather than rebuilt for each one. It is keyed by the
// secret itself, so a changed RALLY_SECRET never signs with the old key.
let cached: { secret: string; key: Promise<CryptoKey> } | undefined;

function signingKey(secret: string) {
  if (cached?.secret !== secret)
    cached = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      ),
    };
  return cached.key;
}

/** HMAC-SHA-256 of `value` under RALLY_SECRET, as lowercase hex. */
export async function sign(value: string) {
  const secret = env.RALLY_SECRET;
  if (secret.length < 32) throw new Error('Rally secret is not configured');
  const mac = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    encoder.encode(value),
  );
  return toHex(new Uint8Array(mac));
}

/** Compares two strings without stopping at the first difference. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
