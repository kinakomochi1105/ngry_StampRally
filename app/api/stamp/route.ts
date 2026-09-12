import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, verifyQr, validOrigin } from '@/lib/server';
import { bodyJson } from '@/lib/data';
import { gate } from '@/lib/gate';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  const closed = await gate(request);
  if (closed) return closed;
  try {
    const data = await bodyJson(request, 2048);
    const hash = await participant(request);
    if (
      !hash ||
      !(await database()
        .prepare('SELECT id FROM participants WHERE event_id=? AND hash=?')
        .bind(event.id, hash)
        .first())
    )
      return json({ error: '参加登録を行ってから読み取ってください。' }, 401);
    const spotId = await verifyQr(data.code);
    if (!spotId)
      return json(
        {
          error:
            'この文化祭の有効なQRコードではありません。設置されたQRコードを確認してください。',
        },
        400,
      );
    const now = Math.floor(Date.now() / 1000);
    const result = await database().batch([
      database()
        .prepare(
          'INSERT INTO stamps (event_id,participant_hash,spot_id,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM locations WHERE id=? AND event_id=? AND active=1) AND EXISTS (SELECT 1 FROM participants WHERE event_id=? AND hash=?) ON CONFLICT(event_id,participant_hash,spot_id) DO NOTHING',
        )
        .bind(event.id, hash, spotId, now, spotId, event.id, event.id, hash),
      // This row intentionally contains no participant hash. It is an aggregate
      // congestion signal and is removed after the short display window.
      database()
        .prepare(
          'INSERT INTO spot_activity (event_id,spot_id,accessed_at) VALUES (?,?,?)',
        )
        .bind(event.id, spotId, now),
      database()
        .prepare('DELETE FROM spot_activity WHERE event_id=? AND accessed_at<?')
        .bind(event.id, now - 15 * 60),
    ]);
    return json({ spotId, duplicate: result[0].meta.changes === 0 });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /入力|JSON/.test(e.message)
            ? e.message
            : '押印を確認できませんでした。同じQRコードで再試行できます。',
      },
      400,
    );
  }
}
