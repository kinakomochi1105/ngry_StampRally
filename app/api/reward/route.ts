import { database } from '@/db';
import { event } from '@/lib/event';
import {
  json,
  participant,
  sign,
  safeEqual,
  validOrigin,
  retentionSeconds,
} from '@/lib/server';
import { bodyJson, staffPinHash, hashStaffPin } from '@/lib/data';

// A 4-6 digit PIN is typed on the participant's own phone, so brute force has
// to be bounded per participant rather than per IP.
const maxAttempts = 8;
const windowSeconds = 900;

export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    const hash = await participant(request);
    if (!hash)
      return json({ error: '参加登録を行ってから操作してください。' }, 401);
    const row = await database()
      .prepare(
        'SELECT id,completed_at AS completedAt,redeemed_at AS redeemedAt FROM participants WHERE event_id=? AND hash=?',
      )
      .bind(event.id, hash)
      .first<{
        id: number;
        completedAt: number | null;
        redeemedAt: number | null;
      }>();
    if (!row)
      return json({ error: '参加登録を行ってから操作してください。' }, 401);
    // Re-confirming an already handed-over reward returns the original record
    // instead of overwriting the timestamp.
    if (row.redeemedAt)
      return json({
        ok: true,
        alreadyRedeemed: true,
        redeemedAt: row.redeemedAt,
        completedAt: row.completedAt,
      });

    const expected = await staffPinHash();
    if (!expected)
      return json(
        {
          error: '係員用の暗証番号が未設定です。運営本部にお知らせください。',
        },
        503,
      );

    const now = Math.floor(Date.now() / 1000);
    const bucket = await sign('reward:' + hash);
    const attempt = await database()
      .prepare(
        'INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts',
      )
      .bind(bucket, now + windowSeconds, now, now, now + windowSeconds)
      .first<{ attempts: number }>();
    if ((attempt?.attempts ?? 99) > maxAttempts)
      return json(
        { error: '入力回数が多いため、15分後にお試しください。' },
        429,
      );

    const data = await bodyJson(request, 1024);
    if (
      typeof data.pin !== 'string' ||
      !safeEqual(await hashStaffPin(data.pin), expected)
    )
      return json({ error: '暗証番号が違います。係員にご確認ください。' }, 401);

    // Completion is recomputed here; the client is never trusted for it.
    const progress = await database()
      .prepare(
        'SELECT (SELECT COUNT(*) FROM locations WHERE event_id=? AND active=1) AS total,COUNT(l.id) AS collected,MAX(s.created_at) AS lastStamp FROM stamps s JOIN locations l ON l.id=s.spot_id AND l.event_id=s.event_id AND l.active=1 WHERE s.event_id=? AND s.participant_hash=? AND s.created_at>?',
      )
      .bind(event.id, event.id, hash, now - retentionSeconds)
      .first<{ total: number; collected: number; lastStamp: number | null }>();
    const total = Number(progress?.total ?? 0);
    const collected = Number(progress?.collected ?? 0);
    if (!total || collected < total)
      return json({ error: 'まだ全てのスタンプが集まっていません。' }, 409);

    const completedAt = progress?.lastStamp ?? now;
    await database().batch([
      database()
        .prepare(
          'UPDATE participants SET redeemed_at=?,completed_at=? WHERE event_id=? AND hash=? AND redeemed_at IS NULL',
        )
        .bind(now, completedAt, event.id, hash),
      database()
        .prepare('DELETE FROM login_attempts WHERE key=? OR expires_at<=?')
        .bind(bucket, now),
      database()
        .prepare(
          'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
        )
        .bind('reward_redeem', String(row.id), now),
    ]);
    return json({ ok: true, redeemedAt: now, completedAt });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /入力|JSON/.test(e.message)
            ? e.message
            : '交換を記録できませんでした。もう一度お試しください。',
      },
      400,
    );
  }
}
