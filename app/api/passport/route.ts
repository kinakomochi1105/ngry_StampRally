import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, retentionSeconds } from '@/lib/server';
import { allSpots, configuration } from '@/lib/data';
export async function GET(request: Request) {
  try {
    const hash = await participant(request);
    const [spots, settings] = await Promise.all([allSpots(), configuration()]);
    const profile = hash
      ? await database()
          .prepare(
            'SELECT id,kind,grade,class_name AS className,number,guest_number AS guestNumber FROM participants WHERE event_id=? AND hash=?',
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
    return json({ stamps, profile, spots, settings });
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
