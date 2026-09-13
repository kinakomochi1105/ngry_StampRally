import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { locations, participants, stamps } from '@/db/schema';
import { reportWindow } from '@/lib/crowd';
import { allSpots } from '@/lib/data';
import { event } from '@/lib/event';
import { requireGate } from '@/lib/gate';
import { json, nowSeconds, route } from '@/lib/http';
import { participantHash, retentionSeconds } from '@/lib/session';
import { configuration } from '@/lib/settings';

export const GET = route(
  'GET /api/passport',
  'スタンプ帳を読み込めませんでした。通信を確認して再試行してください。',
  async (request) => {
    // Nothing about the festival is answered until the visitor has passed the
    // access word, when one is set.
    await requireGate(request);
    const hash = await participantHash(request);
    const now = nowSeconds();
    // Every query is independent of the others, so they all go out together
    // rather than waiting on the profile lookup first.
    const [spots, settings, traffic, profile, stampRows] = await Promise.all([
      allSpots(),
      configuration(),
      // Scan counts and participant reports are counted in subqueries rather
      // than two joins, which would multiply one against the other.
      db().all<{
        spotId: string;
        recentCount: number;
        reportCount: number;
        reportAverage: number | null;
      }>(sql`SELECT l.id AS spotId,
 (SELECT COUNT(*) FROM spot_activity a WHERE a.event_id=l.event_id AND a.spot_id=l.id AND a.accessed_at>${now - 10 * 60}) AS recentCount,
 (SELECT COUNT(*) FROM spot_reports r WHERE r.event_id=l.event_id AND r.spot_id=l.id AND r.created_at>${now - reportWindow}) AS reportCount,
 (SELECT AVG(level) FROM spot_reports r WHERE r.event_id=l.event_id AND r.spot_id=l.id AND r.created_at>${now - reportWindow}) AS reportAverage
 FROM locations l WHERE l.event_id=${event.id} AND l.active=1`),
      hash
        ? db()
            .select({
              id: participants.id,
              kind: participants.kind,
              grade: participants.grade,
              className: participants.className,
              number: participants.number,
              guestNumber: participants.guestNumber,
              nickname: participants.nickname,
              hasRecovery: sql<number>`${participants.recoveryHash} IS NOT NULL`,
              completedAt: participants.completedAt,
              redeemedAt: participants.redeemedAt,
            })
            .from(participants)
            .where(
              and(
                eq(participants.eventId, event.id),
                eq(participants.hash, hash),
              ),
            )
            .get()
        : null,
      hash
        ? db()
            .select({ spotId: stamps.spotId, createdAt: stamps.createdAt })
            .from(stamps)
            .innerJoin(
              locations,
              and(
                eq(locations.id, stamps.spotId),
                eq(locations.active, 1),
                eq(locations.eventId, stamps.eventId),
              ),
            )
            .where(
              and(
                eq(stamps.eventId, event.id),
                eq(stamps.participantHash, hash),
                gt(stamps.createdAt, now - retentionSeconds),
              ),
            )
        : null,
    ]);
    return json({
      // Stamps are only meaningful for a registered participant.
      stamps: profile && stampRows ? stampRows : [],
      profile: profile ?? null,
      spots,
      settings,
      traffic: traffic.map((row) => ({
        spotId: row.spotId,
        recentCount: Number(row.recentCount),
        reportCount: Number(row.reportCount),
        reportAverage:
          row.reportAverage === null ? null : Number(row.reportAverage),
      })),
    });
  },
);
