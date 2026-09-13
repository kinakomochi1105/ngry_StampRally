import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { locations, venueMaps } from '@/db/schema';
import { event, sampleSpots } from './event';
import { UserError } from './http';
import {
  readMapAreas,
  spotIconUrl,
  type FestivalSettings,
  type Spot,
  type VenueMap,
} from './types';

/**
 * The locations, in display order. An uploaded icon is up to 96KB, and the
 * participant screen asks for its passport every minute, so participants get
 * the URL the icon is served from rather than the picture; the console, which
 * edits icons, asks for the pictures themselves with `withIconData`.
 */
export async function allSpots({
  activeOnly = true,
  withIconData = false,
}: { activeOnly?: boolean; withIconData?: boolean } = {}): Promise<Spot[]> {
  const uploaded = sql<number>`${locations.icon} LIKE 'data:%'`;
  const rows = await db()
    .select({
      id: locations.id,
      name: locations.name,
      location: locations.location,
      description: locations.description,
      icon: withIconData
        ? locations.icon
        : sql<string>`CASE WHEN ${uploaded} THEN '' ELSE ${locations.icon} END`,
      uploaded,
      sortOrder: locations.sortOrder,
      active: locations.active,
      updatedAt: locations.updatedAt,
    })
    .from(locations)
    .where(
      and(
        eq(locations.eventId, event.id),
        activeOnly ? eq(locations.active, 1) : undefined,
      ),
    )
    .orderBy(asc(locations.sortOrder), asc(locations.id));
  return rows.map(({ uploaded: isUploaded, updatedAt, ...spot }) => ({
    ...spot,
    icon:
      !withIconData && Number(isUploaded)
        ? spotIconUrl(spot.id, updatedAt)
        : spot.icon,
  }));
}

/** One published location's uploaded icon, as the data URL it was stored as. */
export async function spotIcon(id: string) {
  const row = await db()
    .select({ icon: locations.icon })
    .from(locations)
    .where(
      and(
        eq(locations.eventId, event.id),
        eq(locations.id, id),
        eq(locations.active, 1),
      ),
    )
    .get();
  return row?.icon ?? null;
}

// Bounded, idempotent initial sample seed; explicit admin action only, never a migration.
export const seedSpotStatements = () =>
  sampleSpots.map((spot, index) =>
    db()
      .insert(locations)
      .values({
        ...spot,
        eventId: event.id,
        sortOrder: index,
        active: 1,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoNothing({ target: locations.id }),
  );

/**
 * The venue maps, without the pictures themselves: those are far too big to
 * ride along with the rest of a screen's data, so they are fetched one at a
 * time from /api/map/<id> and cached by the browser.
 */
export async function allMaps(activeOnly = true): Promise<VenueMap[]> {
  const rows = await db()
    .select({
      id: venueMaps.id,
      name: venueMaps.name,
      width: venueMaps.width,
      height: venueMaps.height,
      areas: venueMaps.areas,
      sortOrder: venueMaps.sortOrder,
      active: venueMaps.active,
      updatedAt: venueMaps.updatedAt,
    })
    .from(venueMaps)
    .where(
      and(
        eq(venueMaps.eventId, event.id),
        activeOnly ? eq(venueMaps.active, 1) : undefined,
      ),
    )
    .orderBy(asc(venueMaps.sortOrder), asc(venueMaps.id));
  return rows.map((row) => {
    let areas: unknown = [];
    try {
      areas = JSON.parse(row.areas);
    } catch {}
    return { ...row, areas: readMapAreas(areas) };
  });
}

/** One map's picture, as the data URL it was stored as. */
export async function mapImage(id: string, activeOnly = true) {
  const row = await db()
    .select({ image: venueMaps.image })
    .from(venueMaps)
    .where(
      and(
        eq(venueMaps.eventId, event.id),
        eq(venueMaps.id, id),
        activeOnly ? eq(venueMaps.active, 1) : undefined,
      ),
    )
    .get();
  return row?.image ?? null;
}

export function studentFields(
  data: Record<string, unknown>,
  config: FestivalSettings,
) {
  const grade = typeof data.grade === 'string' ? data.grade : '';
  const className = typeof data.className === 'string' ? data.className : '';
  const number = Number(data.number);
  if (
    !config.grades.includes(grade) ||
    !config.classes.includes(className) ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > config.maxNumber
  )
    throw new UserError('学年・組・出席番号を確認してください。');
  return { grade, className, number };
}

/** An id sent by the console for a location or map: lowercase, digits, hyphens. */
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value);
