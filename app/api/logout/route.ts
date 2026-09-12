import { database } from '@/db';
import { event } from '@/lib/event';
import { json, validOrigin, participant, newParticipant } from '@/lib/server';
import { gate } from '@/lib/gate';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  const closed = await gate(request);
  if (closed) return closed;
  try {
    const hash = await participant(request);
    if (hash) {
      const row = await database()
        .prepare('SELECT id FROM participants WHERE event_id=? AND hash=?')
        .bind(event.id, hash)
        .first<{ id: number }>();
      if (row) {
        const next = await newParticipant(request);
        await database().batch([
          database()
            .prepare(
              'UPDATE stamps SET participant_hash=? WHERE event_id=? AND participant_hash=? AND EXISTS (SELECT 1 FROM participants WHERE id=? AND event_id=? AND hash=?)',
            )
            .bind(next.hash, event.id, hash, row.id, event.id, hash),
          database()
            .prepare(
              'UPDATE participants SET hash=? WHERE id=? AND event_id=? AND hash=?',
            )
            .bind(next.hash, row.id, event.id, hash),
        ]);
      }
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': 'rally_pass=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    });
  } catch {
    return json(
      { error: 'ログアウトを完了できませんでした。再試行してください。' },
      503,
    );
  }
}
