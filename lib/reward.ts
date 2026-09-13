import { and, count, eq, gt, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import { locations, stamps } from '@/db/schema';
import { safeEqual, sign } from './crypto';
import { event } from './event';
import { retentionSeconds } from './session';

/**
 * The code a finished participant shows at the reward desk, as a barcode, a
 * QR code and printed digits. Staff read it with whatever they have — a
 * handheld scanner, a phone camera, or by typing it — and the hand-over is
 * recorded on the staff side, so no PIN ever has to be typed on a visitor's
 * phone.
 *
 * Layout: the participant's row id, zero-padded to at least six digits, then
 * an eight-digit HMAC over that id and the current time window. Digits only,
 * and always an even count, so it packs into the compact Code128 C set and
 * fits across a phone screen. The MAC is what stops a visitor from building
 * the code for someone else's finished pass out of a number they can see.
 *
 * A code is bound to a five-minute window and accepted in that window and
 * the one before, so a screenshot stops working within ten minutes. The
 * participant screen asks for a fresh code while it is open.
 */
const windowSeconds = 300;
const acceptedWindows = 2;
/** Older windows are still recognised, only to tell staff "expired" instead of "invalid". */
const recognisedWindows = 12;
const macDigits = 8;

async function mac(id: number, window: number) {
  const hex = await sign(`reward-code:${event.id}:${id}:${window}`);
  // 48 bits fit a double exactly; reduced to the digit count the code carries.
  return String(parseInt(hex.slice(0, 12), 16) % 10 ** macDigits).padStart(
    macDigits,
    '0',
  );
}

const currentWindow = (now: number) => Math.floor(now / windowSeconds);

export async function issueRewardCode(id: number, now: number) {
  const digits = String(id);
  const width = Math.max(6, digits.length + (digits.length % 2));
  const window = currentWindow(now);
  return {
    code: digits.padStart(width, '0') + (await mac(id, window)),
    refreshAt: (window + 1) * windowSeconds,
  };
}

export type RewardCodeCheck =
  | { ok: true; id: number }
  | { ok: false; reason: 'invalid' | 'expired' };

/**
 * Accepts the code however it arrives. A keyboard-emulating scanner on a
 * Japanese machine often types full-width digits through the IME, and a person
 * copying the printed code adds spaces, so both are normalised away first.
 */
export async function checkRewardCode(
  input: unknown,
  now: number,
): Promise<RewardCodeCheck> {
  const invalid = { ok: false, reason: 'invalid' } as const;
  if (typeof input !== 'string' || input.length > 80) return invalid;
  const digits = input.normalize('NFKC').replace(/\D/g, '');
  if (digits.length < 6 + macDigits || digits.length > 24 || digits.length % 2)
    return invalid;
  const id = Number(digits.slice(0, -macDigits));
  const given = digits.slice(-macDigits);
  if (!Number.isSafeInteger(id) || id < 1) return invalid;
  const window = currentWindow(now);
  for (let back = 0; back < recognisedWindows; back++)
    if (safeEqual(given, await mac(id, window - back)))
      return back < acceptedWindows
        ? { ok: true, id }
        : { ok: false, reason: 'expired' };
  return invalid;
}

/**
 * Whether a pass has every active location, counted on the server at the
 * moment of hand-over. The client's own tally is never trusted for this.
 */
export async function rewardProgress(hash: string, now: number) {
  const row = await db()
    .select({
      total: sql<number>`(SELECT COUNT(*) FROM ${locations} WHERE ${locations.eventId}=${event.id} AND ${locations.active}=1)`,
      collected: count(locations.id),
      lastStamp: max(stamps.createdAt),
    })
    .from(stamps)
    .innerJoin(
      locations,
      and(
        eq(locations.id, stamps.spotId),
        eq(locations.eventId, stamps.eventId),
        eq(locations.active, 1),
      ),
    )
    .where(
      and(
        eq(stamps.eventId, event.id),
        eq(stamps.participantHash, hash),
        gt(stamps.createdAt, now - retentionSeconds),
      ),
    )
    .get();
  const total = Number(row?.total ?? 0);
  const collected = Number(row?.collected ?? 0);
  return {
    total,
    collected,
    complete: total > 0 && collected >= total,
    lastStamp: row?.lastStamp == null ? null : Number(row.lastStamp),
  };
}
