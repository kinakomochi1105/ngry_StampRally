import { and, eq, gte, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { participants } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { event } from '@/lib/event';
import { bodyJson, json, nowSeconds, route, UserError } from '@/lib/http';
import { checkRewardCode, rewardProgress } from '@/lib/reward';

const person = {
  id: participants.id,
  kind: participants.kind,
  grade: participants.grade,
  className: participants.className,
  number: participants.number,
  guestNumber: participants.guestNumber,
  nickname: participants.nickname,
  completedAt: participants.completedAt,
  redeemedAt: participants.redeemedAt,
};

/** How long a desk device may take back a hand-over it has just recorded. */
const deskUndoSeconds = 10 * 60;

/**
 * The reward desk. A scanned or typed code is checked and, when it belongs to
 * a finished pass that has not been handed a reward, recorded as handed over
 * in the same request — one scan per visitor, so a queue keeps moving.
 *
 * Every recognised outcome answers 200 with a `status`, because "already
 * handed over" or "not finished yet" is what the desk needs to read out, not a
 * failed request. The participant is named in the answer so staff can check
 * the face in front of them against it.
 *
 * `action: 'undo'` takes a hand-over back. A desk device may only undo one
 * recorded in the last ten minutes — a mistaken scan — so it cannot reopen old
 * claims for a second prize; an admin may undo any from the participant list.
 */
export const POST = route(
  'POST /api/admin/reward',
  '引き換えを記録できませんでした。もう一度お試しください。',
  async (request) => {
    const session = await requireAdmin(request, {
      roles: ['admin', 'desk'],
      mutation: true,
    });
    const data = await bodyJson(request, 1024);
    const now = nowSeconds();

    if (data.action === 'undo') {
      const id = Number(data.id);
      if (!Number.isInteger(id) || id < 1)
        throw new UserError('参加者を選んでください。');
      const undone = await db()
        .update(participants)
        .set({ redeemedAt: null, completedAt: null })
        .where(
          and(
            eq(participants.id, id),
            eq(participants.eventId, event.id),
            session.role === 'desk'
              ? gte(participants.redeemedAt, now - deskUndoSeconds)
              : undefined,
          ),
        );
      if (!undone.rowsAffected)
        throw new UserError(
          '取り消せるのは10分以内の記録だけです。運営本部にご相談ください。',
          409,
        );
      await auditStatement('reward_undo', String(id), session.actor, now);
      return json({ ok: true });
    }

    const check = await checkRewardCode(data.code, now);
    if (!check.ok) return json({ status: check.reason });

    const row = await db()
      .select({ ...person, hash: participants.hash })
      .from(participants)
      .where(
        and(eq(participants.id, check.id), eq(participants.eventId, event.id)),
      )
      .get();
    // A valid code for a pass deleted since it was shown.
    if (!row) return json({ status: 'invalid' });
    const { hash, ...found } = row;

    if (found.redeemedAt) return json({ status: 'already', person: found });

    const progress = await rewardProgress(hash, now);
    if (!progress.complete)
      return json({
        status: 'incomplete',
        person: found,
        collected: progress.collected,
        total: progress.total,
      });

    // Two desks can read the same screen at once; only one update lands.
    const [recorded] = await db()
      .update(participants)
      .set({ redeemedAt: now, completedAt: progress.lastStamp ?? now })
      .where(
        and(
          eq(participants.id, found.id),
          eq(participants.eventId, event.id),
          isNull(participants.redeemedAt),
        ),
      )
      .returning({
        redeemedAt: participants.redeemedAt,
        completedAt: participants.completedAt,
      });
    if (!recorded) {
      const current = await db()
        .select({
          redeemedAt: participants.redeemedAt,
          completedAt: participants.completedAt,
        })
        .from(participants)
        .where(eq(participants.id, found.id))
        .get();
      return json({ status: 'already', person: { ...found, ...current } });
    }
    await auditStatement('reward_scan', String(found.id), session.actor, now);
    return json({ status: 'redeemed', person: { ...found, ...recorded } });
  },
);
