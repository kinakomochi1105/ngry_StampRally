import { and, avg, count, eq, gt, lt } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { locations, spotReports } from '@/db/schema';
import {
  averageLevel,
  reportCooldown,
  reportWindow,
  validReading,
} from '@/lib/crowd';
import { validId } from '@/lib/data';
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
  enforce,
  hit,
  limitKey,
  limits,
  purgeExpiredStatement,
  tooMany,
} from '@/lib/limits';
import { requireParticipant } from '@/lib/session';

/**
 * A participant's own reading of how busy a location is.
 *
 * The stored row carries the level and the time only — the same anonymous
 * shape as `spot_activity`. Repeat reports are held off through a short-lived
 * counter keyed by an HMAC of the participant and the spot, so the reading
 * itself never has an identifier beside it. The participant is identified by
 * row id, which survives a recovery sign-in, so moving devices does not reset
 * the hold-off; and a connection can only send so many, so a script creating
 * passes cannot drown out the people actually standing in the queue.
 */
export const POST = route(
  'POST /api/report',
  '混み具合を報告できませんでした。時間をおいてお試しください。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const data = await bodyJson(request, 1024);
    const person = await requireParticipant(request);

    const level = Number(data.level);
    if (!validReading(level)) throw new UserError('混み具合を選んでください。');
    const spotId = data.spotId;
    const spot = validId(spotId)
      ? await db()
          .select({ id: locations.id })
          .from(locations)
          .where(
            and(
              eq(locations.id, spotId),
              eq(locations.eventId, event.id),
              eq(locations.active, 1),
            ),
          )
          .get()
      : undefined;
    if (!spot) throw new UserError('この設置場所は選べません。');

    await enforce(
      await limitKey('report-address', clientAddress(request)),
      limits.reportAddress,
    );
    const now = nowSeconds();
    const holdOff = await limitKey('report', event.id, spot.id, person.id);
    if ((await hit(holdOff, reportCooldown, now)) > 1)
      throw tooMany(reportCooldown, '同じ場所の報告は5分に1回までです。');

    await writeBatch([
      db()
        .insert(spotReports)
        .values({ eventId: event.id, spotId: spot.id, level, createdAt: now }),
      // The display window is short, so anything older is of no use to anyone.
      db()
        .delete(spotReports)
        .where(
          and(
            eq(spotReports.eventId, event.id),
            lt(spotReports.createdAt, now - reportWindow),
          ),
        ),
      purgeExpiredStatement(now),
    ]);

    const summary = await db()
      .select({
        reportCount: count(),
        reportAverage: avg(spotReports.level),
      })
      .from(spotReports)
      .where(
        and(
          eq(spotReports.eventId, event.id),
          eq(spotReports.spotId, spot.id),
          gt(spotReports.createdAt, now - reportWindow),
        ),
      )
      .get();
    const reportCount = Number(summary?.reportCount ?? 0);
    const reportAverage = reportCount ? Number(summary?.reportAverage) : null;
    return json({
      spotId: spot.id,
      reportCount,
      reportAverage,
      level: reportAverage === null ? null : averageLevel(reportAverage),
    });
  },
);
