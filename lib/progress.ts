import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { event } from './event';
import { nowSeconds } from './http';
import { nicknameKey } from './nickname';
import { retentionSeconds } from './session';

/**
 * Every participant's progress: stamps at published locations within the
 * retention window, the time of the last one, and the rank that follows from
 * both (ties on count and time share a rank; no stamps, no rank).
 *
 * MATERIALIZED makes SQLite build `ranked` once even when a query reads it
 * more than once, which the console page does for its rows, its count and its
 * totals.
 */
const progressCte = () => sql`progress AS MATERIALIZED (
 SELECT p.id,p.nickname,p.nickname_key AS nicknameKey,p.kind,p.grade,p.class_name AS className,p.number,p.guest_number AS guestNumber,p.created_at AS createdAt,
 p.completed_at AS completedAt,p.redeemed_at AS redeemedAt,
 COUNT(l.id) AS stampCount,MAX(CASE WHEN l.id IS NOT NULL THEN s.created_at END) AS lastStamp
 FROM participants p LEFT JOIN stamps s ON s.participant_hash=p.hash AND s.event_id=p.event_id AND s.created_at>${nowSeconds() - retentionSeconds}
 LEFT JOIN locations l ON l.id=s.spot_id AND l.event_id=p.event_id AND l.active=1 WHERE p.event_id=${event.id} GROUP BY p.id
),ranked AS MATERIALIZED (SELECT *,CASE WHEN stampCount>0 THEN RANK() OVER(ORDER BY stampCount DESC,lastStamp ASC) ELSE NULL END AS ranking FROM progress)`;

export type ProgressRow = {
  id: number;
  nickname: string | null;
  kind: 'student' | 'guest';
  grade: string | null;
  className: string | null;
  number: number | null;
  guestNumber: number | null;
  createdAt: number;
  completedAt: number | null;
  redeemedAt: number | null;
  stampCount: number;
  lastStamp: number | null;
  ranking: number | null;
};

export type ProgressStats = {
  total: number;
  students: number;
  guests: number;
  completed: number;
  redeemed: number;
  stamps: number;
  spotCount: number;
};

export const pageSize = 50;

const likePattern = (value: string) =>
  '%' + value.replace(/[!%_]/g, '!$&') + '%';

/**
 * One page of the console's participant list, its matching count and the
 * festival totals, in a single query. The totals are over everyone; the page
 * and the count follow the filters. An out-of-range page still returns one
 * row carrying the count and totals, with the participant columns null.
 */
export async function participantPage({
  kind,
  query,
  page,
  sort,
}: {
  kind: string;
  query: string;
  page: number;
  sort: 'rank' | 'recent';
}) {
  // The search box matches how an administrator refers to a participant:
  // "1年 A組 12番" or "#4" for the identifier, and the nickname. Nicknames are
  // compared through the same normalised key the registration stores, so
  // case and full-width characters do not have to match.
  const order =
    sort === 'rank'
      ? sql.raw('stampCount DESC,lastStamp ASC,id')
      : sql.raw('id DESC');
  const outerOrder =
    sort === 'rank'
      ? sql.raw('page.stampCount DESC,page.lastStamp ASC,page.id')
      : sql.raw('page.id DESC');
  const rows = await db().all<
    Partial<ProgressRow> & Omit<ProgressStats, never> & { matchCount: number }
  >(sql`WITH ${progressCte()},
filtered AS (SELECT * FROM ranked WHERE (${kind}='' OR kind=${kind}) AND (${query}='' OR (COALESCE(grade,'') || '年 ' || COALESCE(className,'') || '組 ' || COALESCE(number,'') || '番 #' || COALESCE(guestNumber,'')) LIKE ${likePattern(query)} ESCAPE '!' OR COALESCE(nicknameKey,'') LIKE ${likePattern(nicknameKey(query))} ESCAPE '!')),
totals AS (SELECT COUNT(*) AS total,COALESCE(SUM(kind='student'),0) AS students,COALESCE(SUM(kind='guest'),0) AS guests,
 COALESCE(SUM(redeemedAt IS NOT NULL),0) AS redeemed,COALESCE(SUM(stampCount),0) AS stamps,
 (SELECT COUNT(*) FROM locations WHERE event_id=${event.id} AND active=1) AS spotCount FROM ranked),
page AS (SELECT id,nickname,kind,grade,className,number,guestNumber,createdAt,completedAt,redeemedAt,stampCount,lastStamp,ranking FROM filtered ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize})
SELECT totals.total,totals.students,totals.guests,totals.redeemed,totals.stamps,totals.spotCount,
 (SELECT COUNT(*) FROM ranked WHERE totals.spotCount>0 AND stampCount=totals.spotCount) AS completed,
 (SELECT COUNT(*) FROM filtered) AS matchCount,page.*
FROM totals LEFT JOIN page ON 1 ORDER BY ${outerOrder}`);
  const first = rows[0];
  const stats: ProgressStats = {
    total: Number(first?.total ?? 0),
    students: Number(first?.students ?? 0),
    guests: Number(first?.guests ?? 0),
    completed: Number(first?.completed ?? 0),
    redeemed: Number(first?.redeemed ?? 0),
    stamps: Number(first?.stamps ?? 0),
    spotCount: Number(first?.spotCount ?? 0),
  };
  return {
    stats,
    count: Number(first?.matchCount ?? 0),
    rows: rows
      .filter((row) => row.id != null)
      .map(
        (row): ProgressRow => ({
          id: Number(row.id),
          nickname: row.nickname ?? null,
          kind: row.kind as ProgressRow['kind'],
          grade: row.grade ?? null,
          className: row.className ?? null,
          number: row.number ?? null,
          guestNumber: row.guestNumber ?? null,
          createdAt: Number(row.createdAt),
          completedAt: row.completedAt ?? null,
          redeemedAt: row.redeemedAt ?? null,
          stampCount: Number(row.stampCount),
          lastStamp: row.lastStamp ?? null,
          ranking: row.ranking ?? null,
        }),
      ),
  };
}

/** Every participant, in registration order, for the CSV export. */
export const allProgress = (limit: number) =>
  db().all<ProgressRow>(
    sql`WITH ${progressCte()} SELECT id,nickname,kind,grade,className,number,guestNumber,createdAt,completedAt,redeemedAt,stampCount,lastStamp,ranking FROM ranked ORDER BY id LIMIT ${limit}`,
  );
