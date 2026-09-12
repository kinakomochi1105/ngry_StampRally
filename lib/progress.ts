import { database } from '@/db';
import { event } from '@/lib/event';
import { retentionSeconds } from './server';
export const progressSql = `WITH progress AS (
 SELECT p.id,p.nickname,p.nickname_key AS nicknameKey,p.kind,p.grade,p.class_name AS className,p.number,p.guest_number AS guestNumber,p.created_at AS createdAt,
 p.completed_at AS completedAt,p.redeemed_at AS redeemedAt,
 COUNT(l.id) AS stampCount,MAX(CASE WHEN l.id IS NOT NULL THEN s.created_at END) AS lastStamp
 FROM participants p LEFT JOIN stamps s ON s.participant_hash=p.hash AND s.event_id=p.event_id AND s.created_at>?
 LEFT JOIN locations l ON l.id=s.spot_id AND l.event_id=p.event_id AND l.active=1 WHERE p.event_id=? GROUP BY p.id
),ranked AS (SELECT *,CASE WHEN stampCount>0 THEN RANK() OVER(ORDER BY stampCount DESC,lastStamp ASC) ELSE NULL END AS ranking FROM progress)`;
export function progressArgs() {
  return [Math.floor(Date.now() / 1000) - retentionSeconds, event.id];
}
export async function statistics() {
  const total =
    (
      await database()
        .prepare(
          'SELECT COUNT(*) AS count FROM locations WHERE event_id=? AND active=1',
        )
        .bind(event.id)
        .first<{ count: number }>()
    )?.count ?? 0;
  const stats = await database()
    .prepare(
      progressSql +
        ` SELECT COUNT(*) AS total,COALESCE(SUM(kind='student'),0) AS students,COALESCE(SUM(kind='guest'),0) AS guests,COALESCE(SUM(stampCount=? AND ?>0),0) AS completed,COALESCE(SUM(redeemedAt IS NOT NULL),0) AS redeemed,COALESCE(SUM(stampCount),0) AS stamps FROM ranked`,
    )
    .bind(...progressArgs(), total, total)
    .first();
  return { ...stats, spotCount: total };
}
