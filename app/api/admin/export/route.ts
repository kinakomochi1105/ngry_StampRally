import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { csvDocument } from '@/lib/csv';
import { route, UserError } from '@/lib/http';
import { allProgress } from '@/lib/progress';

const maxRows = 10000;
const iso = (seconds: number | null) =>
  seconds ? new Date(Number(seconds) * 1000).toISOString() : '';

export const GET = route(
  'GET /api/admin/export',
  'CSVを作成できませんでした。',
  async (request) => {
    const session = await requireAdmin(request);
    const rows = await allProgress(maxRows + 1);
    if (rows.length > maxRows)
      throw new UserError(`一度に出力できる上限は${maxRows}人です。`);
    const body = csvDocument([
      [
        '管理番号',
        '種別',
        'ニックネーム',
        '学年',
        '組',
        '出席番号',
        '一般客ID',
        '獲得数',
        '順位',
        '登録日時',
        '最終押印日時',
        '報酬交換',
        'コンプリート日時',
        '交換日時',
      ],
      ...rows.map((r) => [
        r.id,
        r.kind === 'student' ? '生徒' : '一般客',
        r.nickname,
        r.grade,
        r.className,
        r.number,
        r.guestNumber ? `#${r.guestNumber}` : '',
        r.stampCount,
        r.ranking,
        iso(r.createdAt),
        iso(r.lastStamp),
        r.redeemedAt ? '交換済み' : '未交換',
        iso(r.completedAt),
        iso(r.redeemedAt),
      ]),
    ]);
    await auditStatement('export_csv', String(rows.length), session.actor);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="festival-participants.csv"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
