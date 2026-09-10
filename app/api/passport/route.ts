import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, retentionSeconds, logFailure } from '@/lib/server';
import { allSpots, configuration } from '@/lib/data';
export async function GET(request: Request) {
  try {
    const hash = await participant(request);
    const now = Math.floor(Date.now() / 1000);
    // Every query is independent of the others, so they all go out together
    // rather than waiting on the profile lookup first.
    const [spots, settings, trafficRows, profile, stampRows] =
      await Promise.all([
        allSpots(),
        configuration(),
        database()
          .prepare(
            'SELECT l.id AS spotId,COUNT(a.id) AS recentCount FROM locations l LEFT JOIN spot_activity a ON a.event_id=l.event_id AND a.spot_id=l.id AND a.accessed_at>? WHERE l.event_id=? AND l.active=1 GROUP BY l.id',
          )
          .bind(now - 10 * 60, event.id)
          .all<{ spotId: string; recentCount: number }>(),
        hash
          ? database()
              .prepare(
                'SELECT id,kind,grade,class_name AS className,number,guest_number AS guestNumber,nickname,(recovery_hash IS NOT NULL) AS hasRecovery,completed_at AS completedAt,redeemed_at AS redeemedAt FROM participants WHERE event_id=? AND hash=?',
              )
              .bind(event.id, hash)
              .first()
          : null,
        hash
          ? database()
              .prepare(
                'SELECT s.spot_id AS spotId,s.created_at AS createdAt FROM stamps s JOIN locations l ON l.id=s.spot_id AND l.active=1 AND l.event_id=s.event_id WHERE s.event_id=? AND s.participant_hash=? AND s.created_at>?',
              )
              .bind(event.id, hash, now - retentionSeconds)
              .all()
          : null,
      ]);
    // Stamps are only meaningful for a registered participant.
    const stamps = profile && stampRows ? stampRows.results : [];
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
  } catch (e) {
    logFailure('GET /api/passport', e);
    return json(
      {
        error:
          'スタンプ帳を読み込めませんでした。通信を確認して再試行してください。',
      },
      503,
    );
  }
}
