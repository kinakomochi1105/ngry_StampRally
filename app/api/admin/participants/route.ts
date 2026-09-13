import { and, asc, eq, sql } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { locations, participants, stamps } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { studentFields } from '@/lib/data';
import { event } from '@/lib/event';
import {
  bodyJson,
  isUniqueViolation,
  json,
  nowSeconds,
  route,
  UserError,
} from '@/lib/http';
import { participantPage } from '@/lib/progress';
import { retentionSeconds } from '@/lib/session';
import { configuration } from '@/lib/settings';

async function findParticipant(id: number) {
  const row = await db()
    .select({ hash: participants.hash, kind: participants.kind })
    .from(participants)
    .where(and(eq(participants.id, id), eq(participants.eventId, event.id)))
    .get();
  if (!row) throw new UserError('参加者が見つかりません。', 404);
  return row;
}

export const GET = route(
  'GET /api/admin/participants',
  '参加者一覧を取得できませんでした。',
  async (request) => {
    await requireAdmin(request);
    const url = new URL(request.url);
    if (url.searchParams.has('id')) {
      const id = Number(url.searchParams.get('id'));
      const { hash } = await findParticipant(id);
      const since = nowSeconds() - retentionSeconds;
      const [history, spots] = await Promise.all([
        db()
          .select({
            name: sql<string>`COALESCE(${locations.name}, ${stamps.spotId})`,
            createdAt: stamps.createdAt,
          })
          .from(stamps)
          .leftJoin(
            locations,
            and(
              eq(locations.id, stamps.spotId),
              eq(locations.eventId, stamps.eventId),
            ),
          )
          .where(
            and(eq(stamps.eventId, event.id), eq(stamps.participantHash, hash)),
          )
          .orderBy(asc(stamps.createdAt)),
        db()
          .select({
            id: locations.id,
            name: locations.name,
            location: locations.location,
            active: locations.active,
            collected: sql<number>`CASE WHEN ${stamps.createdAt} > ${since} THEN 1 ELSE 0 END`,
            collectedAt: sql<
              number | null
            >`CASE WHEN ${stamps.createdAt} > ${since} THEN ${stamps.createdAt} END`,
          })
          .from(locations)
          .leftJoin(
            stamps,
            and(
              eq(stamps.spotId, locations.id),
              eq(stamps.eventId, locations.eventId),
              eq(stamps.participantHash, hash),
            ),
          )
          .where(eq(locations.eventId, event.id))
          .orderBy(asc(locations.sortOrder), asc(locations.id)),
      ]);
      return json({ stamps: history, spots });
    }
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(url.searchParams.get('page'))) || 1),
    );
    const result = await participantPage({
      kind: url.searchParams.get('kind') ?? '',
      query: (url.searchParams.get('q') ?? '').slice(0, 80),
      page,
      sort: url.searchParams.get('sort') === 'rank' ? 'rank' : 'recent',
    });
    return json({ ...result, page });
  },
);

export const POST = route(
  'POST /api/admin/participants',
  '更新できませんでした。',
  async (request) => {
    const session = await requireAdmin(request, { mutation: true });
    const data = await bodyJson(request);
    const id = Number(data.id);
    if (!Number.isInteger(id) || id < 1)
      throw new UserError('参加者を選んでください。');
    const row = await findParticipant(id);
    const now = nowSeconds();
    const byId = and(
      eq(participants.id, id),
      eq(participants.eventId, event.id),
    );
    const audit = (action: string, target = String(id)) =>
      auditStatement(action, target, session.actor, now);

    if (data.action === 'stamp') {
      const spotId = data.spotId;
      if (typeof spotId !== 'string' || typeof data.collected !== 'boolean')
        throw new UserError('スタンプの指定を確認してください。');
      const spot = await db()
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, spotId), eq(locations.eventId, event.id)))
        .get();
      if (!spot) throw new UserError('設置場所が見つかりません。', 404);
      // A new stamp takes the current time; one already held within the
      // retention window keeps its original time.
      const change = data.collected
        ? db()
            .insert(stamps)
            .values({
              eventId: event.id,
              participantHash: row.hash,
              spotId,
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: [stamps.eventId, stamps.participantHash, stamps.spotId],
              set: { createdAt: now },
              setWhere: sql`${stamps.createdAt} <= ${now - retentionSeconds}`,
            })
        : db()
            .delete(stamps)
            .where(
              and(
                eq(stamps.eventId, event.id),
                eq(stamps.spotId, spotId),
                eq(stamps.participantHash, row.hash),
              ),
            );
      await writeBatch([
        change,
        audit(
          data.collected ? 'stamp_grant' : 'stamp_revoke',
          `${id}:${spotId}`,
        ),
      ]);
    } else if (data.action === 'redeem') {
      if (typeof data.redeemed !== 'boolean')
        throw new UserError('交換状態を指定してください。');
      if (data.redeemed) {
        // Hand-over recorded at the desk: keep the participant's own last
        // stamp as the completion time when one exists.
        const progress = await db()
          .select({ lastStamp: sql<number | null>`MAX(${stamps.createdAt})` })
          .from(stamps)
          .innerJoin(
            locations,
            and(
              eq(locations.id, stamps.spotId),
              eq(locations.eventId, stamps.eventId),
              eq(locations.active, 1),
            ),
          )
          .where(
            and(
              eq(stamps.eventId, event.id),
              eq(stamps.participantHash, row.hash),
            ),
          )
          .get();
        await writeBatch([
          db()
            .update(participants)
            .set({
              redeemedAt: sql`COALESCE(${participants.redeemedAt}, ${now})`,
              completedAt: sql`COALESCE(${participants.completedAt}, ${progress?.lastStamp ?? now})`,
            })
            .where(byId),
          audit('reward_grant'),
        ]);
      } else
        await writeBatch([
          db()
            .update(participants)
            .set({ redeemedAt: null, completedAt: null })
            .where(byId),
          audit('reward_revoke'),
        ]);
    } else if (data.action === 'edit') {
      if (row.kind !== 'student')
        throw new UserError('一般客のIDは変更できません。');
      const fields = studentFields(data, await configuration());
      try {
        await writeBatch([
          db().update(participants).set(fields).where(byId),
          audit('edit'),
        ]);
      } catch (error) {
        if (isUniqueViolation(error))
          throw new UserError('この学年・組・出席番号は使用されています。');
        throw error;
      }
    } else if (data.action === 'reset' && data.confirm === 'スタンプをリセット')
      await writeBatch([
        db()
          .delete(stamps)
          .where(
            and(
              eq(stamps.eventId, event.id),
              eq(stamps.participantHash, row.hash),
            ),
          ),
        audit('reset'),
      ]);
    else if (data.action === 'delete' && data.confirm === '参加者を削除')
      await writeBatch([
        db()
          .delete(stamps)
          .where(
            and(
              eq(stamps.eventId, event.id),
              eq(stamps.participantHash, row.hash),
            ),
          ),
        db().delete(participants).where(byId),
        audit('delete'),
      ]);
    else throw new UserError('操作内容と確認文字を確認してください。');
    return json({ ok: true });
  },
);
