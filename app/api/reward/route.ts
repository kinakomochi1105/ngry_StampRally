import { and, eq, isNull } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { participants } from '@/db/schema';
import { auditStatement } from '@/lib/audit';
import { safeEqual } from '@/lib/crypto';
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
import { issueRewardCode, rewardProgress } from '@/lib/reward';
import { requireParticipant } from '@/lib/session';
import { hashSecret, secretHash } from '@/lib/settings';

/**
 * The code for the reward desk, asked for again every few seconds while the
 * participant's claim screen is open. The same call is how that screen learns
 * the hand-over happened on the staff side: once it has, the answer is the
 * record instead of a code.
 */
export const GET = route(
  'GET /api/reward',
  '引き換えコードを表示できませんでした。通信を確認してください。',
  async (request) => {
    await requireGate(request);
    const person = await requireParticipant(request);
    if (person.redeemedAt)
      return json({
        redeemedAt: person.redeemedAt,
        completedAt: person.completedAt,
      });
    const now = nowSeconds();
    if (!(await rewardProgress(person.hash, now)).complete)
      throw new UserError('まだ全てのスタンプが集まっていません。', 409);
    return json(await issueRewardCode(person.id, now));
  },
);

/**
 * The fallback for a desk with no scanner: staff type the PIN on the
 * participant's own phone.
 *
 * A 6-8 digit PIN is only as strong as the limit on guessing it, so:
 * - only a finished pass may try at all (checked before the PIN);
 * - wrong PINs are counted per participant *row*, which a new device or a
 *   recovery sign-in does not reset;
 * - and per connection, so registering many passes does not buy more guesses.
 * Every attempt is counted up front, so parallel requests cannot slip past the
 * limit, and a correct PIN takes its attempt back.
 */
export const POST = route(
  'POST /api/reward',
  '交換を記録できませんでした。もう一度お試しください。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const person = await requireParticipant(request);
    // Re-confirming an already handed-over reward returns the original record
    // instead of overwriting the timestamp.
    if (person.redeemedAt)
      return json({
        ok: true,
        alreadyRedeemed: true,
        redeemedAt: person.redeemedAt,
        completedAt: person.completedAt,
      });

    const expected = await secretHash('staff-pin');
    if (!expected)
      throw new UserError(
        '係員用の暗証番号が未設定です。運営本部にお知らせください。',
        503,
      );

    const now = nowSeconds();
    const progress = await rewardProgress(person.hash, now);
    if (!progress.complete)
      throw new UserError('まだ全てのスタンプが集まっていません。', 409);

    const participantKey = await limitKey('staff-pin', event.id, person.id);
    const addressKey = await limitKey(
      'staff-pin-address',
      clientAddress(request),
    );
    const [[byParticipant], [byAddress]] = await writeBatch([
      countStatement(participantKey, limits.staffPinParticipant.window, now),
      countStatement(addressKey, limits.staffPinAddress.window, now),
    ]).then((results) =>
      results.map((result) => result.rows.map((row) => Number(row.attempts))),
    );
    if (
      byParticipant > limits.staffPinParticipant.max ||
      byAddress > limits.staffPinAddress.max
    )
      throw tooMany(
        limits.staffPinParticipant.window,
        '入力回数が多いため、15分後にお試しください。',
      );

    const data = await bodyJson(request, 1024);
    if (
      typeof data.pin !== 'string' ||
      !safeEqual(await hashSecret('staff-pin', data.pin), expected)
    )
      throw new UserError('暗証番号が違います。係員にご確認ください。', 401);

    const completedAt = progress.lastStamp ?? now;
    await writeBatch([
      db()
        .update(participants)
        .set({ redeemedAt: now, completedAt })
        .where(
          and(
            eq(participants.id, person.id),
            eq(participants.eventId, event.id),
            isNull(participants.redeemedAt),
          ),
        ),
      forgetStatement(participantKey, now),
      refundStatement(addressKey),
      auditStatement('reward_redeem', String(person.id), 'participant', now),
    ]);
    return json({ ok: true, redeemedAt: now, completedAt });
  },
);
