import { database } from '@/db';
import { event } from '@/lib/event';
import {
  json,
  newParticipant,
  sign,
  safeEqual,
  validOrigin,
} from '@/lib/server';
import { bodyJson } from '@/lib/data';
import { nicknameKey } from '@/lib/nickname';
import { normalizeCode, recoveryLimit } from '@/lib/recovery';
const invalid = 'ニックネームまたは復旧コードが一致しません。';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    const data = await bodyJson(request, 2048),
      code = normalizeCode(data.recoveryCode);
    const codeHash = await sign('recovery:' + code);
    const limit = await recoveryLimit(request, codeHash);
    if (limit.limited)
      return json(
        { error: '試行回数が多いため、15分後にお試しください。' },
        429,
        { 'Retry-After': '900' },
      );
    if (!code || typeof data.nickname !== 'string' || data.nickname.length > 80)
      return json({ error: invalid }, 401);
    const row = await database()
      .prepare(
        'SELECT id,hash,nickname_key AS nicknameKey FROM participants WHERE event_id=? AND recovery_hash=?',
      )
      .bind(event.id, codeHash)
      .first<{ id: number; hash: string; nicknameKey: string }>();
    const provided = await sign('nickname:' + nicknameKey(data.nickname)),
      expected = await sign('nickname:' + (row?.nicknameKey ?? ''));
    if (!row || !safeEqual(provided, expected))
      return json({ error: invalid }, 401);
    const session = await newParticipant(request);
    const results = await database().batch([
      database()
        .prepare(
          'UPDATE stamps SET participant_hash=? WHERE event_id=? AND participant_hash=? AND EXISTS (SELECT 1 FROM participants WHERE id=? AND event_id=? AND hash=? AND recovery_hash=?)',
        )
        .bind(
          session.hash,
          event.id,
          row.hash,
          row.id,
          event.id,
          row.hash,
          codeHash,
        ),
      database()
        .prepare(
          'UPDATE participants SET hash=? WHERE id=? AND event_id=? AND hash=? AND recovery_hash=?',
        )
        .bind(session.hash, row.id, event.id, row.hash, codeHash),
    ]);
    if (results[1].meta.changes !== 1)
      return json(
        { error: '別の再ログイン操作が完了しました。もう一度お試しください。' },
        409,
      );
    await database().batch([
      database()
        .prepare('DELETE FROM login_attempts WHERE key=? OR expires_at<=?')
        .bind(limit.targetKey, Math.floor(Date.now() / 1000)),
      database()
        .prepare(
          'UPDATE login_attempts SET attempts=MAX(0,attempts-1) WHERE key=?',
        )
        .bind(limit.ipKey),
    ]);
    return json({ ok: true }, 200, { 'Set-Cookie': session.cookie });
  } catch {
    return json(
      { error: '再ログインできませんでした。通信を確認してお試しください。' },
      400,
    );
  }
}
