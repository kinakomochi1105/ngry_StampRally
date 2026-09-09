import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, newParticipant, validOrigin } from '@/lib/server';
import { bodyJson, configuration, studentFields } from '@/lib/data';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    const data = await bodyJson(request);
    const config = await configuration();
    if (!config.registrationOpen)
      return json({ error: 'ただいま新規受付を停止しています。' }, 409);
    const existingHash = await participant(request);
    if (existingHash) {
      const existing = await database()
        .prepare('SELECT id FROM participants WHERE event_id=? AND hash=?')
        .bind(event.id, existingHash)
        .first();
      if (existing) return json({ ok: true });
    }
    if (data.kind !== 'student' && data.kind !== 'guest')
      return json({ error: '生徒または一般客を選んでください。' }, 400);
    const profile =
      data.kind === 'student' ? studentFields(data, config) : null;
    const created = existingHash
      ? { hash: existingHash, cookie: '' }
      : await newParticipant(request);
    try {
      if (data.kind === 'guest') {
        await database().batch([
          database()
            .prepare(
              'INSERT INTO guest_sequence (event_id,next_number) VALUES (?,1) ON CONFLICT(event_id) DO UPDATE SET next_number=next_number+1',
            )
            .bind(event.id),
          database()
            .prepare(
              "INSERT INTO participants (event_id,hash,kind,guest_number,created_at) SELECT ?,?,'guest',next_number,? FROM guest_sequence WHERE event_id=?",
            )
            .bind(
              event.id,
              created.hash,
              Math.floor(Date.now() / 1000),
              event.id,
            ),
        ]);
      } else {
        await database()
          .prepare(
            "INSERT INTO participants (event_id,hash,kind,grade,class_name,number,created_at) VALUES (?,?,'student',?,?,?,?)",
          )
          .bind(
            event.id,
            created.hash,
            profile!.grade,
            profile!.className,
            profile!.number,
            Math.floor(Date.now() / 1000),
          )
          .run();
      }
    } catch (e) {
      if (String(e).includes('UNIQUE'))
        return json(
          {
            error:
              'この学年・組・出席番号は登録済みです。元のブラウザで開くか、受付で管理者にご相談ください。',
          },
          409,
        );
      throw e;
    }
    return json(
      { ok: true },
      201,
      created.cookie ? { 'Set-Cookie': created.cookie } : {},
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /確認|入力|JSON/.test(e.message)
            ? e.message
            : '登録を完了できませんでした。時間をおいて再試行してください。',
      },
      400,
    );
  }
}
