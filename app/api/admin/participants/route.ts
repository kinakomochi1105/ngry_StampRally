import { database } from '@/db';
import { event } from '@/lib/event';
import { json, retentionSeconds, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import { bodyJson, configuration, studentFields } from '@/lib/data';
import { progressSql, progressArgs, statistics } from '@/lib/progress';
import { nicknameKey } from '@/lib/nickname';
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
      const spots = await database()
        .prepare(
          'SELECT l.id,l.name,l.location,l.active,CASE WHEN s.created_at>? THEN 1 ELSE 0 END AS collected,CASE WHEN s.created_at>? THEN s.created_at END AS collectedAt FROM locations l LEFT JOIN participants p ON p.id=? AND p.event_id=l.event_id LEFT JOIN stamps s ON s.spot_id=l.id AND s.event_id=l.event_id AND s.participant_hash=p.hash WHERE l.event_id=? ORDER BY l.sort_order,l.id',
        )
        .bind(
          Math.floor(Date.now() / 1000) - retentionSeconds,
          Math.floor(Date.now() / 1000) - retentionSeconds,
          id,
          event.id,
        )
        .all();
      return json({ stamps: stamps.results, spots: spots.results });
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
    // The search box matches how an administrator refers to a participant:
    // "1年 A組 12番" or "#4" for the identifier, and the nickname. Nicknames are
    // compared through the same normalised key the registration stores, so
    // case and full-width characters do not have to match.
    const filter = ` WHERE (?='' OR kind=?) AND (?='' OR (COALESCE(grade,'') || '年 ' || COALESCE(className,'') || '組 ' || COALESCE(number,'') || '番 #' || COALESCE(guestNumber,'')) LIKE ? ESCAPE '!' OR COALESCE(nicknameKey,'') LIKE ? ESCAPE '!')`;
    const escape = (value: string) =>
      '%' + value.replace(/[!%_]/g, '!$&') + '%';
    const pattern = escape(q);
    const nicknamePattern = escape(nicknameKey(q));
    const args = [...progressArgs(), kind, kind, q, pattern, nicknamePattern];
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
  } catch (e) {
    logFailure('GET /api/admin/participants', e);
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
    if (data.action === 'stamp') {
      if (
        typeof data.spotId !== 'string' ||
        typeof data.collected !== 'boolean'
      )
        return json({ error: 'スタンプの指定を確認してください。' }, 400);
      const spot = await database()
        .prepare('SELECT id FROM locations WHERE id=? AND event_id=?')
        .bind(data.spotId, event.id)
        .first();
      if (!spot) return json({ error: '設置場所が見つかりません。' }, 404);
      const now = Math.floor(Date.now() / 1000);
      const change = data.collected
        ? database()
            .prepare(
              'INSERT INTO stamps (event_id,participant_hash,spot_id,created_at) SELECT event_id,hash,?,? FROM participants WHERE id=? AND event_id=? ON CONFLICT(event_id,participant_hash,spot_id) DO UPDATE SET created_at=excluded.created_at WHERE stamps.created_at<=?',
            )
            .bind(data.spotId, now, id, event.id, now - retentionSeconds)
        : database()
            .prepare(
              'DELETE FROM stamps WHERE event_id=? AND spot_id=? AND participant_hash=(SELECT hash FROM participants WHERE id=? AND event_id=?)',
            )
            .bind(event.id, data.spotId, id, event.id);
      await database().batch([
        change,
        database()
          .prepare(
            'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
          )
          .bind(
            data.collected ? 'stamp_grant' : 'stamp_revoke',
            String(id) + ':' + data.spotId,
            now,
          ),
      ]);
    } else if (data.action === 'redeem') {
      if (typeof data.redeemed !== 'boolean')
        return json({ error: '交換状態を指定してください。' }, 400);
      const now = Math.floor(Date.now() / 1000);
      if (data.redeemed) {
        // Hand-over recorded at the desk: keep the participant's own last
        // stamp as the completion time when one exists.
        const progress = await database()
          .prepare(
            'SELECT MAX(s.created_at) AS lastStamp FROM stamps s JOIN locations l ON l.id=s.spot_id AND l.event_id=s.event_id AND l.active=1 WHERE s.event_id=? AND s.participant_hash=?',
          )
          .bind(event.id, row.hash)
          .first<{ lastStamp: number | null }>();
        await database().batch([
          database()
            .prepare(
              'UPDATE participants SET redeemed_at=COALESCE(redeemed_at,?),completed_at=COALESCE(completed_at,?) WHERE id=? AND event_id=?',
            )
            .bind(now, progress?.lastStamp ?? now, id, event.id),
          database()
            .prepare(
              'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
            )
            .bind('reward_grant', String(id), now),
        ]);
      } else {
        await database().batch([
          database()
            .prepare(
              'UPDATE participants SET redeemed_at=NULL,completed_at=NULL WHERE id=? AND event_id=?',
            )
            .bind(id, event.id),
          database()
            .prepare(
              'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
            )
            .bind('reward_revoke', String(id), now),
        ]);
      }
    } else if (data.action === 'edit') {
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
