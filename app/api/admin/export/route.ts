import { database } from '@/db';
import { guard } from '@/lib/admin';
import { json } from '@/lib/server';
import { progressSql, progressArgs } from '@/lib/progress';
import { audit } from '@/lib/data';
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const rows = (
      await database()
        .prepare(progressSql + ' SELECT * FROM ranked ORDER BY id LIMIT 10001')
        .bind(...progressArgs())
        .all<Record<string, string | number | null>>()
    ).results;
    if (rows.length > 10000)
      return json({ error: '一度に出力できる上限は10000人です。' }, 400);
    const cell = (value: string | number | null) => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const lines = [
      [
        '管理番号',
        '種別',
        '学年',
        '組',
        '出席番号',
        '一般客ID',
        '獲得数',
        '順位',
        '登録日時',
        '最終押印日時',
      ],
      ...rows.map((r) => [
        r.id,
        r.kind === 'student' ? '生徒' : '一般客',
        r.grade,
        r.className,
        r.number,
        r.guestNumber ? `#${r.guestNumber}` : '',
        r.stampCount,
        r.ranking,
        new Date(Number(r.createdAt) * 1000).toISOString(),
        r.lastStamp ? new Date(Number(r.lastStamp) * 1000).toISOString() : '',
      ]),
    ];
    await audit('export_csv', String(rows.length));
    return new Response(
      '\uFEFF' + lines.map((r) => r.map(cell).join(',')).join('\r\n'),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="festival-participants.csv"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch {
    return json({ error: 'CSVを作成できませんでした。' }, 503);
  }
}
