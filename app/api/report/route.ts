import { database } from '@/db';
import { event } from '@/lib/event';
import { bodyJson } from '@/lib/data';
import { gate } from '@/lib/gate';
import { json, participant, sign, validOrigin } from '@/lib/server';
import {
  averageLevel,
  reportCooldown,
  reportWindow,
  validReading,
} from '@/lib/crowd';

/**
 * A participant's own reading of how busy a location is.
 *
 * The stored row carries the level and the time only — the same anonymous
 * shape as `spot_activity`. Repeat reports are held off through a short-lived
 * key in `login_attempts`, which is a hash of the participant and the spot, so
 * the reading itself never has an identifier beside it.
 */
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  const closed = await gate(request);
  if (closed) return closed;
  try {
    const data = await bodyJson(request, 1024);
    const hash = await participant(request);
    if (!hash)
      return json({ error: '参加登録を行ってから操作してください。' }, 401);

    const spotId = typeof data.spotId === 'string' ? data.spotId : '';
    const level = Number(data.level);
    if (!validReading(level))
      return json({ error: '混み具合を選んでください。' }, 400);
    if (
      !/^[a-z0-9-]{1,64}$/.test(spotId) ||
      !(await database()
        .prepare(
          'SELECT id FROM locations WHERE id=? AND event_id=? AND active=1',
        )
        .bind(spotId, event.id)
        .first())
    )
      return json({ error: 'この設置場所は選べません。' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const key = await sign(`report:${event.id}:${spotId}:${hash}`);
    const attempts = Number(
      (
        await database()
          .prepare(
            'INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts',
          )
          .bind(key, now + reportCooldown, now, now, now + reportCooldown)
          .first<{ attempts: number }>()
      )?.attempts ?? 0,
    );
    if (attempts > 1)
      return json({ error: '同じ場所の報告は5分に1回までです。' }, 429);

    await database().batch([
      database()
        .prepare(
          'INSERT INTO spot_reports (event_id,spot_id,level,created_at) VALUES (?,?,?,?)',
        )
        .bind(event.id, spotId, level, now),
      // The display window is short, so anything older is of no use to anyone.
      database()
        .prepare('DELETE FROM spot_reports WHERE event_id=? AND created_at<?')
        .bind(event.id, now - reportWindow),
      database()
        .prepare('DELETE FROM login_attempts WHERE expires_at<=?')
        .bind(now),
    ]);

    const summary = await database()
      .prepare(
        'SELECT COUNT(*) AS reportCount,AVG(level) AS reportAverage FROM spot_reports WHERE event_id=? AND spot_id=? AND created_at>?',
      )
      .bind(event.id, spotId, now - reportWindow)
      .first<{ reportCount: number; reportAverage: number }>();
    const reportCount = Number(summary?.reportCount ?? 0);
    const reportAverage = reportCount ? Number(summary?.reportAverage) : null;
    return json({
      spotId,
      reportCount,
      reportAverage,
      level: reportAverage === null ? null : averageLevel(reportAverage),
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /入力|JSON/.test(e.message)
            ? e.message
            : '混み具合を報告できませんでした。時間をおいてお試しください。',
      },
      400,
    );
  }
}
