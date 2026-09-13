import { and, eq, exists } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { participants, stamps } from '@/db/schema';
import { safeEqual, sign } from '@/lib/crypto';
import { event } from '@/lib/event';
import { requireGate } from '@/lib/gate';
import {
  bodyJson,
  clientAddress,
  json,
  nowSeconds,
  requireSameOrigin,
  route,
  UserError,
} from '@/lib/http';
import {
  countStatement,
  forgetStatement,
  limitKey,
  limits,
  refundStatement,
  tooMany,
} from '@/lib/limits';
import { nicknameKey } from '@/lib/nickname';
import { normalizeCode, recoveryHash } from '@/lib/recovery';
import { newParticipant } from '@/lib/session';

const invalid = 'ニックネームまたは復旧コードが一致しません。';

/**
 * Brings a pass back on a new device with its nickname and recovery code.
 * The answer never says which of the two was wrong. Failures are limited per
 * code and per connection; a successful sign-in takes its attempt back from
 * the connection, so classmates on the same line do not use up each other's.
 */
export const POST = route(
  'POST /api/recovery/login',
  '再ログインできませんでした。通信を確認してお試しください。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const data = await bodyJson(request, 2048);
    const code = normalizeCode(data.recoveryCode);
    const codeHash = await recoveryHash(code);
    const now = nowSeconds();
    const addressKey = await limitKey(
      'recovery-address',
      clientAddress(request),
    );
    const codeKey = await limitKey('recovery-code', codeHash);
    const [[byAddress], [byCode]] = await writeBatch([
      countStatement(addressKey, limits.recoveryAddress.window, now),
      countStatement(codeKey, limits.recoveryCode.window, now),
    ]).then((results) =>
      results.map((result) => result.rows.map((row) => Number(row.attempts))),
    );
    if (
      byAddress > limits.recoveryAddress.max ||
      byCode > limits.recoveryCode.max
    )
      throw tooMany(limits.recoveryCode.window);
    if (!code || typeof data.nickname !== 'string' || data.nickname.length > 80)
      throw new UserError(invalid, 401);

    const row = await db()
      .select({
        id: participants.id,
        hash: participants.hash,
        nicknameKey: participants.nicknameKey,
      })
      .from(participants)
      .where(
        and(
          eq(participants.eventId, event.id),
          eq(participants.recoveryHash, codeHash),
        ),
      )
      .get();
    // Both sides are compared as HMACs of equal length, whether or not the
    // code matched anyone, so the time taken does not tell them apart.
    const provided = await sign('nickname:' + nicknameKey(data.nickname));
    const expected = await sign('nickname:' + (row?.nicknameKey ?? ''));
    if (!row || !safeEqual(provided, expected))
      throw new UserError(invalid, 401);

    const session = await newParticipant(request);
    const holder = and(
      eq(participants.id, row.id),
      eq(participants.eventId, event.id),
      eq(participants.hash, row.hash),
      eq(participants.recoveryHash, codeHash),
    );
    const [, moved] = await writeBatch([
      db()
        .update(stamps)
        .set({ participantHash: session.hash })
        .where(
          and(
            eq(stamps.eventId, event.id),
            eq(stamps.participantHash, row.hash),
            exists(
              db()
                .select({ id: participants.id })
                .from(participants)
                .where(holder),
            ),
          ),
        ),
      db().update(participants).set({ hash: session.hash }).where(holder),
      forgetStatement(codeKey, now),
      refundStatement(addressKey),
    ]);
    if (moved.rowsAffected !== 1)
      throw new UserError(
        '別の再ログイン操作が完了しました。もう一度お試しください。',
        409,
      );
    return json({ ok: true }, 200, { 'Set-Cookie': session.cookie });
  },
);
