import { database } from '@/db';
import { event } from '@/lib/event';
import { json } from '@/lib/server';
import { guard } from '@/lib/admin';
import { bodyJson, configuration, studentFields } from '@/lib/data';
import { progressSql, progressArgs, statistics } from '@/lib/progress';
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('id')) {
      const id = Number(url.searchParams.get('id'));
      const row = await database()
        .prepare('SELECT hash FROM participants WHERE id=? AND event_id=?')
        .bind(id, event.id)
        .first<{ hash: string }>();
      if (!row) return json({ error: '参加者が見つかりません。' }, 404);
      const stamps = await database()
        .prepare(
          'SELECT COALESCE(l.name,s.spot_id) AS name,s.created_at AS createdAt FROM stamps s LEFT JOIN locations l ON l.id=s.spot_id AND l.event_id=s.event_id WHERE s.event_id=? AND s.participant_hash=? ORDER BY s.created_at',
        )
        .bind(event.id, row.hash)
        .all();
      return json({ stamps: stamps.results });
    }
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(url.searchParams.get('page'))) || 1),
    );
    const kind = url.searchParams.get('kind') ?? '';
    const q = (url.searchParams.get('q') ?? '').slice(0, 80);
    const order =
      url.searchParams.get('sort') === 'rank'
        ? 'stampCount DESC,lastStamp ASC,id'
        : 'id DESC';
    const filter = ` WHERE (?='' OR kind=?) AND (?='' OR (COALESCE(grade,'') || '年 ' || COALESCE(className,'') || '組 ' || COALESCE(number,'') || '番 #' || COALESCE(guestNumber,'')) LIKE ? ESCAPE '!')`;
    const pattern = '%' + q.replace(/[!%_]/g, '!$&') + '%';
    const args = [...progressArgs(), kind, kind, q, pattern];
    const [rows, count, stats] = await Promise.all([
      database()
        .prepare(
          progressSql +
            ' SELECT * FROM ranked' +
            filter +
            ` ORDER BY ${order} LIMIT 50 OFFSET ?`,
        )
        .bind(...args, (page - 1) * 50)
        .all(),
      database()
        .prepare(progressSql + ' SELECT COUNT(*) AS count FROM ranked' + filter)
        .bind(...args)
        .first<{ count: number }>(),
      statistics(),
    ]);
    return json({ rows: rows.results, count: count?.count ?? 0, page, stats });
  } catch {
    return json({ error: '参加者一覧を取得できませんでした。' }, 503);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  try {
    const data = await bodyJson(request);
    const id = Number(data.id);
    if (!Number.isInteger(id) || id < 1)
      return json({ error: '参加者を選んでください。' }, 400);
    const row = await database()
      .prepare('SELECT hash,kind FROM participants WHERE id=? AND event_id=?')
      .bind(id, event.id)
      .first<{ hash: string; kind: string }>();
    if (!row) return json({ error: '参加者が見つかりません。' }, 404);
    const log = database()
      .prepare(
        'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
      )
      .bind(String(data.action), String(id), Math.floor(Date.now() / 1000));
    if (data.action === 'edit') {
      if (row.kind !== 'student')
        return json({ error: '一般客のIDは変更できません。' }, 400);
      const f = studentFields(data, await configuration());
      await database().batch([
        database()
          .prepare(
            'UPDATE participants SET grade=?,class_name=?,number=? WHERE id=? AND event_id=?',
          )
          .bind(f.grade, f.className, f.number, id, event.id),
        log,
      ]);
    } else if (
      data.action === 'reset' &&
      data.confirm === 'スタンプをリセット'
    ) {
      await database().batch([
        database()
          .prepare('DELETE FROM stamps WHERE event_id=? AND participant_hash=?')
          .bind(event.id, row.hash),
        log,
      ]);
    } else if (data.action === 'delete' && data.confirm === '参加者を削除') {
      await database().batch([
        database()
          .prepare('DELETE FROM stamps WHERE event_id=? AND participant_hash=?')
          .bind(event.id, row.hash),
        database()
          .prepare('DELETE FROM participants WHERE id=? AND event_id=?')
          .bind(id, event.id),
        log,
      ]);
    } else
      return json({ error: '操作内容と確認文字を確認してください。' }, 400);
    return json({ ok: true });
  } catch (e) {
    return json(
      {
        error: String(e).includes('UNIQUE')
          ? 'この学年・組・出席番号は使用されています。'
          : e instanceof Error && /確認/.test(e.message)
            ? e.message
            : '更新できませんでした。',
      },
      400,
    );
  }
}
