import { and, eq } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { venueMaps } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { allMaps, allSpots, validId } from '@/lib/data';
import { event } from '@/lib/event';
import { bodyJson, json, nowSeconds, route, UserError } from '@/lib/http';
import { maxMapImageLength, readMapAreas, validMapImage } from '@/lib/types';

/** Every map, published or not, with the locations the areas can point at. */
export const GET = route(
  'GET /api/admin/maps',
  '会場マップを取得できませんでした。',
  async (request) => {
    await requireAdmin(request);
    const [maps, spots] = await Promise.all([
      allMaps(false),
      allSpots({ activeOnly: false }),
    ]);
    return json({ maps, spots });
  },
);

/**
 * Saves one map. The picture is optional on an edit: leaving it out keeps the
 * one already stored, so moving a few areas does not re-upload a megabyte.
 */
export const POST = route(
  'POST /api/admin/maps',
  '会場マップを保存できませんでした。',
  async (request) => {
    const session = await requireAdmin(request, { mutation: true });
    // The picture travels inline, so this route accepts a far larger body
    // than the 8KB default.
    const data = await bodyJson(request, maxMapImageLength + 32768);
    const id =
      typeof data.id === 'string' ? data.id : 'map-' + crypto.randomUUID();
    if (!validId(id)) throw new UserError('マップを確認してください。');
    const now = nowSeconds();
    const byId = and(eq(venueMaps.eventId, event.id), eq(venueMaps.id, id));

    if (data.action === 'delete') {
      await writeBatch([
        db().delete(venueMaps).where(byId),
        auditStatement('delete_map', id, session.actor, now),
      ]);
      return json({ ok: true });
    }

    const name = (typeof data.name === 'string' ? data.name : '').trim();
    const image = typeof data.image === 'string' ? data.image.trim() : '';
    const width = Number(data.width ?? 0);
    const height = Number(data.height ?? 0);
    const sortOrder = Number(data.sortOrder ?? 0);
    const active = data.active === true || data.active === 1 ? 1 : 0;
    if (!name || name.length > 40)
      throw new UserError('マップの名前を確認してください。');
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 8000 ||
      height > 8000 ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 999
    )
      throw new UserError('マップの大きさと表示順を確認してください。');
    if (image && !validMapImage(image))
      throw new UserError(
        '画像を確認してください。PNGかJPEGで、小さめの画像を選んでください。',
      );
    // Areas point at locations of this event, and nothing else.
    const known = new Set(
      (await allSpots({ activeOnly: false })).map((spot) => spot.id),
    );
    const areas = readMapAreas(data.areas).map((area) => ({
      ...area,
      spotId: known.has(area.spotId) ? area.spotId : '',
    }));
    if (areas.some((area) => !area.spotId && !area.label))
      throw new UserError('リンク先か表示名のどちらかを設定してください。');

    const values = {
      name,
      areas: JSON.stringify(areas),
      sortOrder,
      active,
      updatedAt: now,
    };
    if (image) {
      const withImage = { ...values, image, width, height };
      await writeBatch([
        db()
          .insert(venueMaps)
          .values({ id, eventId: event.id, ...withImage })
          .onConflictDoUpdate({
            target: venueMaps.id,
            set: withImage,
            setWhere: eq(venueMaps.eventId, event.id),
          }),
        auditStatement('save_map', id, session.actor, now),
      ]);
    } else {
      const [changed] = await writeBatch([
        db().update(venueMaps).set(values).where(byId),
        auditStatement('save_map', id, session.actor, now),
      ]);
      if (!changed.rowsAffected) throw new UserError('画像を選んでください。');
    }
    return json({ ok: true, id });
  },
);
