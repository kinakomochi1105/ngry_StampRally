import { database } from '@/db';
import { event } from '@/lib/event';
import { json, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import { audit, bodyJson } from '@/lib/data';
import { checkRewardCode, rewardProgress } from '@/lib/reward';
import type { Profile } from '@/lib/types';

type Person = Omit<Profile, 'hasRecovery'> & { hash: string };

/**
 * The reward desk. A scanned or typed code is checked and, when it belongs to
 * a finished pass that has not been handed a reward, recorded as handed over
 * in the same request — one scan per visitor, so a queue keeps moving.
 *
 * Every recognised outcome answers 200 with a `status`, because "already
 * handed over" or "not finished yet" is what the desk needs to read out, not a
 * failed request. The participant is named in the answer so staff can check
 * the face in front of them against it.
 */
export async function POST(request: Request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  try {
    const data = await bodyJson(request, 1024);
    const now = Math.floor(Date.now() / 1000);
    const check = await checkRewardCode(data.code, now);
    if (!check.ok) return json({ status: check.reason });

    const row = await database()
      .prepare(
        'SELECT id,hash,kind,grade,class_name AS className,number,guest_number AS guestNumber,nickname,completed_at AS completedAt,redeemed_at AS redeemedAt FROM participants WHERE id=? AND event_id=?',
      )
      .bind(check.id, event.id)
      .first<Person>();
    // A valid code for a pass deleted since it was shown.
    if (!row) return json({ status: 'invalid' });
    const { hash, ...person } = row;

    if (person.redeemedAt) return json({ status: 'already', person });

    const progress = await rewardProgress(hash, now);
    if (!progress.complete)
      return json({
        status: 'incomplete',
        person,
        collected: progress.collected,
        total: progress.total,
      });

    // Two desks can read the same screen at once; only one update lands.
    const recorded = await database()
      .prepare(
        'UPDATE participants SET redeemed_at=?,completed_at=? WHERE id=? AND event_id=? AND redeemed_at IS NULL RETURNING redeemed_at AS redeemedAt,completed_at AS completedAt',
      )
      .bind(now, progress.lastStamp ?? now, person.id, event.id)
      .first<{ redeemedAt: number; completedAt: number }>();
    if (!recorded) {
      const current = await database()
        .prepare(
          'SELECT redeemed_at AS redeemedAt,completed_at AS completedAt FROM participants WHERE id=? AND event_id=?',
        )
        .bind(person.id, event.id)
        .first<{ redeemedAt: number | null; completedAt: number | null }>();
      return json({ status: 'already', person: { ...person, ...current } });
    }
    await audit('reward_scan', String(person.id));
    return json({ status: 'redeemed', person: { ...person, ...recorded } });
  } catch (e) {
    if (e instanceof Error && /入力|JSON/.test(e.message))
      return json({ error: e.message }, 400);
    logFailure('POST /api/admin/reward', e);
    return json(
      { error: '引き換えを記録できませんでした。もう一度お試しください。' },
      503,
    );
  }
}
