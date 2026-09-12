import { database } from '@/db';
import { event } from '@/lib/event';
import { json, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import {
  bodyJson,
  configuration,
  staffPinHash,
  hashStaffPin,
  saveStaffPinStatement,
} from '@/lib/data';
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return json({
      settings: await configuration(),
      // Only whether a PIN exists; the value itself never leaves the server.
      staffPinSet: (await staffPinHash()) !== null,
      logs: (
        await database()
          .prepare(
            'SELECT action,target,created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 30',
          )
          .all()
      ).results,
    });
  } catch (e) {
    logFailure('GET /api/admin/settings', e);
    return json({ error: '設定を取得できませんでした。' }, 503);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  try {
    const data = await bodyJson(request);
    const now = Math.floor(Date.now() / 1000);
    if (data.action === 'purge') {
      if (data.confirm !== '全参加データを削除')
        return json({ error: '確認文字が一致しません。' }, 400);
      await database().batch([
        database()
          .prepare('DELETE FROM stamps WHERE event_id=?')
          .bind(event.id),
        database()
          .prepare('DELETE FROM spot_activity WHERE event_id=?')
          .bind(event.id),
        database()
          .prepare('DELETE FROM spot_reports WHERE event_id=?')
          .bind(event.id),
        database()
          .prepare('DELETE FROM participants WHERE event_id=?')
          .bind(event.id),
        database()
          .prepare(
            'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
          )
          .bind('purge_event', event.id, now),
      ]);
      return json({ ok: true });
    }
    if (data.action === 'staffPin') {
      const pin = typeof data.pin === 'string' ? data.pin.trim() : '';
      if (data.clear === true) {
        await database().batch([
          saveStaffPinStatement(null),
          database()
            .prepare(
              'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
            )
            .bind('staff_pin_clear', event.id, now),
        ]);
        return json({ ok: true, staffPinSet: false });
      }
      if (!/^\d{4,8}$/.test(pin))
        throw new Error('係員用暗証番号は4〜8桁の数字で入力してください。');
      await database().batch([
        saveStaffPinStatement(await hashStaffPin(pin)),
        database()
          .prepare(
            'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
          )
          .bind('staff_pin_set', event.id, now),
      ]);
      return json({ ok: true, staffPinSet: true });
    }
    const config = data.settings as Record<string, unknown>;
    if (!config) throw new Error('設定がありません。');
    const list = (v: unknown, max: number) => {
      if (!Array.isArray(v) || !v.length || v.length > max)
        throw new Error('学年・組を1つ以上入力してください。');
      const a = v.map((x: unknown) => (typeof x === 'string' ? x.trim() : ''));
      if (a.some((x) => !x || x.length > 12) || new Set(a).size !== a.length)
        throw new Error(
          '学年・組は重複しない12文字以内の名称を入力してください。',
        );
      return a;
    };
    const grades = list(config.grades, 20),
      classes = list(config.classes, 50),
      maxNumber = Number(config.maxNumber),
      title = (typeof config.title === 'string' ? config.title : '').trim();
    if (
      !title ||
      title.length > 60 ||
      !Number.isInteger(maxNumber) ||
      maxNumber < 1 ||
      maxNumber > 999
    )
      throw new Error('文化祭名と出席番号の上限を確認してください。');
    const rawWords = config.nicknameBlockedWords ?? [];
    if (
      !Array.isArray(rawWords) ||
      rawWords.length > 100 ||
      rawWords.some(
        (x: unknown) =>
          typeof x !== 'string' || x.trim().length < 1 || x.length > 40,
      )
    )
      throw new Error('追加禁止語は40文字以内、100件までで入力してください。');
    const nicknameBlockedWords = [
      ...new Set((rawWords as string[]).map((x) => x.trim())),
    ];
    const value = JSON.stringify({
      title,
      grades,
      classes,
      maxNumber,
      registrationOpen: config.registrationOpen === true,
      nicknameBlockedWords,
    });
    await database().batch([
      database()
        .prepare(
          'INSERT INTO settings (event_id,value) VALUES (?,?) ON CONFLICT(event_id) DO UPDATE SET value=excluded.value',
        )
        .bind(event.id, value),
      database()
        .prepare(
          'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
        )
        .bind('save_settings', event.id, now),
    ]);
    return json({ ok: true });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /入力|確認|設定/.test(e.message)
            ? e.message
            : '設定を保存できませんでした。',
      },
      400,
    );
  }
}
