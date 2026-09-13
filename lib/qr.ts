import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { locations } from '@/db/schema';
import { safeEqual, sign } from './crypto';
import { event } from './event';

/**
 * Printed QR codes carry a link so the phone's own camera app can open them:
 * `https://<site>/s/<spotId>/<signature>`. That path forwards to the
 * participant screen, which posts the same link back to /api/stamp. Posters
 * printed before the link format hold the bare `rally:<event>:<spot>:<signature>`
 * token, which the in-app scanner still decodes, so both shapes stay valid.
 * Only the signature binds a code to this festival: the host of the link is
 * never trusted and is never compared with anything.
 */
export const stampPath = (spotId: string, signature: string) =>
  `/s/${spotId}/${signature}`;

export const qrSignature = (spotId: string) => sign(`qr:${event.id}:${spotId}`);

/** Splits a scanned value into its location id and signature, or null. */
export function parseQr(
  value: string,
  eventId: string,
): { spotId: string; signature: string } | null {
  let parts: string[] | null = null;
  if (value.startsWith('rally:')) {
    const token = value.split(':');
    parts = token.length === 4 && token[1] === eventId ? token.slice(2) : null;
  } else {
    let path = value;
    if (/^https?:\/\//i.test(value)) {
      try {
        path = new URL(value).pathname;
      } catch {
        return null;
      }
    }
    const link = /^\/?s\/([^/?#]+)\/([^/?#]+)\/?$/.exec(path);
    if (link) {
      try {
        parts = [decodeURIComponent(link[1]), link[2]];
      } catch {
        return null;
      }
    }
  }
  if (!parts) return null;
  const [spotId, signature] = parts;
  if (!/^[a-z0-9-]{1,64}$/.test(spotId) || !/^[a-f0-9]{64}$/.test(signature))
    return null;
  return { spotId, signature };
}

/** The location a scanned code stamps, when it is genuine and published. */
export async function verifyQr(code: unknown) {
  if (typeof code !== 'string' || code.length > 512) return null;
  const parts = parseQr(code.trim(), event.id);
  if (!parts) return null;
  if (!safeEqual(parts.signature, await qrSignature(parts.spotId))) return null;
  const spot = await db()
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.id, parts.spotId),
        eq(locations.eventId, event.id),
        eq(locations.active, 1),
      ),
    )
    .get();
  return spot ? parts.spotId : null;
}
