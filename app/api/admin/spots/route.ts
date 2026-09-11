import { database } from '@/db';
import { event } from '@/lib/event';
import { json, sign, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import { allSpots, bodyJson, seedSpots, audit } from '@/lib/data';
import { maxSpotIconLength, validSpotIcon } from '@/lib/types';
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const rows = await allSpots(false);
    return json({
      spots: await Promise.all(
        rows.map(async (s) => ({
          ...s,
          code: `rally:${event.id}:${s.id}:${await sign(`qr:${event.id}:${s.id}`)}`,
        })),
      ),
    });
  } catch (e) {
    logFailure('GET /api/admin/spots', e);
    return json({ error: '設置場所を取得できませんでした。' }, 503);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request, true);
  if (denied) return denied;
  try {
    // An uploaded icon travels inline with the location, so this route
    // accepts more than the default 8KB body.
    const data = await bodyJson(request, maxSpotIconLength + 8192);
    if (data.action === 'seed') {
      await seedSpots();
      await audit('seed_spots', event.id);
      return json({ ok: true });
    }
    const id =
      typeof data.id === 'string' ? data.id : 'spot-' + crypto.randomUUID();
    const name = (typeof data.name === 'string' ? data.name : '').trim(),
      location = (
        typeof data.location === 'string' ? data.location : ''
      ).trim(),
      description = (
        typeof data.description === 'string' ? data.description : ''
      ).trim(),
      icon = (typeof data.icon === 'string' ? data.icon : '').trim(),
      sortOrder = Number(data.sortOrder ?? 0),
      active = data.active === true || data.active === 1 ? 1 : 0;
    if (!validSpotIcon(icon))
      throw new Error(
        'アイコンを確認してください。画像はPNGかJPEGで、小さいものを選んでください。',
      );
    if (
      !/^[a-z0-9-]{1,64}$/.test(id) ||
      !name ||
      name.length > 60 ||
      !location ||
      location.length > 80 ||
      description.length > 160 ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 999
    )
      throw new Error('名称・場所・表示順を確認してください。');
    await database().batch([
      database()
        .prepare(
          'INSERT INTO locations (id,event_id,name,location,description,icon,sort_order,active) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active WHERE locations.event_id=excluded.event_id',
        )
        .bind(
          id,
          event.id,
          name,
          location,
          description,
          icon,
          sortOrder,
          active,
        ),
      database()
        .prepare(
          'INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)',
        )
        .bind('save_spot', id, Math.floor(Date.now() / 1000)),
    ]);
    return json({ ok: true });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && /確認/.test(e.message)
            ? e.message
            : '設置場所を保存できませんでした。',
      },
      400,
    );
  }
}
