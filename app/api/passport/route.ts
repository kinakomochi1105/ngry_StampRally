import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, retentionSeconds } from '@/lib/server';
import { allSpots, configuration } from '@/lib/data';
export async function GET(request: Request) {
  try {
    const hash = await participant(request);
    const [spots, settings, trafficRows] = await Promise.all([
      allSpots(),
      configuration(),
      database()
        .prepare(
          'SELECT l.id AS spotId,COUNT(a.id) AS recentCount FROM locations l LEFT JOIN spot_activity a ON a.event_id=l.event_id AND a.spot_id=l.id AND a.accessed_at>? WHERE l.event_id=? AND l.active=1 GROUP BY l.id',
        )
        .bind(Math.floor(Date.now() / 1000) - 10 * 60, event.id)
        .all<{ spotId: string; recentCount: number }>(),
    ]);
    const profile = hash
      ? await database()
          .prepare(
            'SELECT id,kind,grade,class_name AS className,number,guest_number AS guestNumber,nickname,(recovery_hash IS NOT NULL) AS hasRecovery FROM participants WHERE event_id=? AND hash=?',
          )
          .bind(event.id, hash)
          .first()
      : null;
    const stamps = profile
      ? (
          await database()
            .prepare(
              'SELECT s.spot_id AS spotId,s.created_at AS createdAt FROM stamps s JOIN locations l ON l.id=s.spot_id AND l.active=1 AND l.event_id=s.event_id WHERE s.event_id=? AND s.participant_hash=? AND s.created_at>?',
            )
            .bind(
              event.id,
              hash,
              Math.floor(Date.now() / 1000) - retentionSeconds,
            )
            .all()
        ).results
      : [];
    return json({
      stamps,
      profile,
      spots,
      settings,
      traffic: trafficRows.results.map((row) => ({
        spotId: row.spotId,
        recentCount: Number(row.recentCount),
      })),
    });
  } catch {
    return json(
      {
        error:
          'スタンプ帳を読み込めませんでした。通信を確認して再試行してください。',
      },
      503,
    );
  }
}
