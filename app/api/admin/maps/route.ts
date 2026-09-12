import { database } from '@/db';
import { event } from '@/lib/event';
import { json, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import { allMaps, allSpots, bodyJson, audit } from '@/lib/data';
import {
  maxMapImageLength,
  readMapAreas,
  validMapImage,
  type MapArea,
} from '@/lib/types';

/** Every map, published or not, with the locations the areas can point at. */
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return json({ maps: await allMaps(false), spots: await allSpots(false) });
  } catch (e) {
    logFailure('GET /api/admin/maps', e);
    return json({ error: '会場マップを取得できませんでした。' }, 503);
  }
}

/**
 * Saves one map. The picture is optional on an edit: leaving it out keeps the
 * one already stored, so moving a few areas does not re-upload a megabyte.
 */
export async function POST(request: Request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  try {
    // The picture travels inline, so this route accepts a far larger body
    // than the 8KB default.
    const data = await bodyJson(request, maxMapImageLength + 32768);
    const id =
      typeof data.id === 'string' ? data.id : 'map-' + crypto.randomUUID();
    if (!/^[a-z0-9-]{1,64}$/.test(id))
      throw new Error('マップを確認してください。');

    if (data.action === 'delete') {
      await database()
        .prepare('DELETE FROM venue_maps WHERE event_id=? AND id=?')
        .bind(event.id, id)
        .run();
      await audit('delete_map', id);
      return json({ ok: true });
    }

    const name = (typeof data.name === 'string' ? data.name : '').trim();
    const image = typeof data.image === 'string' ? data.image.trim() : '';
    const width = Number(data.width ?? 0);
    const height = Number(data.height ?? 0);
    const sortOrder = Number(data.sortOrder ?? 0);
    const active = data.active === true || data.active === 1 ? 1 : 0;
    const areas: MapArea[] = readMapAreas(data.areas);
    if (!name || name.length > 40)
      throw new Error('マップの名前を確認してください。');
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
      throw new Error('マップの大きさと表示順を確認してください。');
    if (image && !validMapImage(image))
      throw new Error(
        '画像を確認してください。PNGかJPEGで、小さめの画像を選んでください。',
      );
    // Areas point at locations of this event, and nothing else.
    const known = new Set((await allSpots(false)).map((spot) => spot.id));
    const linked = areas.map((area) => ({
      ...area,
      spotId: known.has(area.spotId) ? area.spotId : '',
    }));
    if (linked.some((area) => !area.spotId && !area.label))
      throw new Error('リンク先か表示名のどちらかを設定してください。');

    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(linked);
    if (image) {
      await database()
        .prepare(
          'INSERT INTO venue_maps (id,event_id,name,image,width,height,areas,sort_order,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,image=excluded.image,width=excluded.width,height=excluded.height,areas=excluded.areas,sort_order=excluded.sort_order,active=excluded.active,updated_at=excluded.updated_at WHERE venue_maps.event_id=excluded.event_id',
        )
        .bind(
          id,
          event.id,
          name,
          image,
          width,
          height,
          payload,
          sortOrder,
          active,
          now,
        )
        .run();
    } else {
      const changed = await database()
        .prepare(
          'UPDATE venue_maps SET name=?,areas=?,sort_order=?,active=?,updated_at=? WHERE event_id=? AND id=?',
        )
        .bind(name, payload, sortOrder, active, now, event.id, id)
        .run();
      if (!changed.meta.changes) throw new Error('画像を選んでください。');
    }
    await audit('save_map', id);
    return json({ ok: true, id });
  } catch (e) {
    const message =
      e instanceof Error && /確認|選んで|設定/.test(e.message)
        ? e.message
        : '会場マップを保存できませんでした。';
    if (message === '会場マップを保存できませんでした。')
      logFailure('POST /api/admin/maps', e);
    return json({ error: message }, 400);
  }
}
