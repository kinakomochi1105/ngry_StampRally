import { and, eq, lt, sql } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { spotActivity } from '@/db/schema';
import { event } from '@/lib/event';
import { requireGate } from '@/lib/gate';
import {
  bodyJson,
  json,
  nowSeconds,
  requireSameOrigin,
  route,
  UserError,
} from '@/lib/http';
import { verifyQr } from '@/lib/qr';
import { requireParticipant } from '@/lib/session';

export const POST = route(
  'POST /api/stamp',
  '押印を確認できませんでした。同じQRコードで再試行できます。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const data = await bodyJson(request, 2048);
    const person = await requireParticipant(
      request,
      '参加登録を行ってから読み取ってください。',
    );
    const spotId = await verifyQr(data.code);
    if (!spotId)
      throw new UserError(
        'この文化祭の有効なQRコードではありません。設置されたQRコードを確認してください。',
      );
    const now = nowSeconds();
    const [stamp] = await writeBatch([
      // Re-checked inside the transaction: the location may have been hidden,
      // or the pass moved to another device, since the checks above.
      sql`INSERT INTO stamps (event_id,participant_hash,spot_id,created_at)
 SELECT ${event.id},${person.hash},${spotId},${now}
 WHERE EXISTS (SELECT 1 FROM locations WHERE id=${spotId} AND event_id=${event.id} AND active=1)
 AND EXISTS (SELECT 1 FROM participants WHERE event_id=${event.id} AND hash=${person.hash})
 ON CONFLICT(event_id,participant_hash,spot_id) DO NOTHING`,
      // This row intentionally contains no participant hash. It is an
      // aggregate congestion signal and is removed after the display window.
      db()
        .insert(spotActivity)
        .values({ eventId: event.id, spotId, accessedAt: now }),
      db()
        .delete(spotActivity)
        .where(
          and(
            eq(spotActivity.eventId, event.id),
            lt(spotActivity.accessedAt, now - 15 * 60),
          ),
        ),
    ]);
    return json({ spotId, duplicate: stamp.rowsAffected === 0 });
  },
);
