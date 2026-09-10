import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, validOrigin } from '@/lib/server';
import { bodyJson, configuration } from '@/lib/data';
import { validateNickname, nicknameKey } from '@/lib/nickname';
import { loadForbiddenWords } from '@/lib/forbidden';
import { makeRecovery } from '@/lib/recovery';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    const hash = await participant(request);
    if (!hash) return json({ error: 'ログインが必要です。' }, 401);
    const row = await database()
      .prepare(
        'SELECT id,nickname FROM participants WHERE event_id=? AND hash=?',
      )
      .bind(event.id, hash)
      .first<{ id: number; nickname: string | null }>();
    if (!row) return json({ error: 'ログインが必要です。' }, 401);
    const data = await bodyJson(request, 2048),
      config = await configuration();
    // Existing names remain usable even if the organizer later adds a blocked word.
    const name = row.nickname
      ? { nickname: row.nickname, key: nicknameKey(row.nickname) }
      : validateNickname(data.nickname, [
          ...(await loadForbiddenWords()),
          ...(config.nicknameBlockedWords ?? []),
        ]);
    const recovery = await makeRecovery();
    const result = await database()
      .prepare(
        'UPDATE participants SET nickname=?,nickname_key=?,recovery_hash=? WHERE id=? AND event_id=? AND hash=?',
      )
      .bind(name.nickname, name.key, recovery.hash, row.id, event.id, hash)
      .run();
    if (result.meta.changes !== 1)
      return json({ error: 'ページを開き直してください。' }, 409);
    return json({ nickname: name.nickname, recoveryCode: recovery.code });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /ニックネーム|入力|名前/.test(e.message)
            ? e.message
            : '復旧コードを発行できませんでした。',
      },
      400,
    );
  }
}
