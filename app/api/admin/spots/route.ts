import { sql } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { locations } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { allSpots, seedSpotStatements, validId } from '@/lib/data';
import { event } from '@/lib/event';
import {
  bodyJson,
  json,
  nowSeconds,
  route,
  siteOrigin,
  UserError,
} from '@/lib/http';
import { qrSignature, stampPath } from '@/lib/qr';
import { maxSpotIconLength, validSpotIcon } from '@/lib/types';

export const GET = route(
  'GET /api/admin/spots',
  '設置場所を取得できませんでした。',
  async (request) => {
    await requireAdmin(request);
    const rows = await allSpots({ activeOnly: false, withIconData: true });
    const origin = siteOrigin(request);
    return json({
      spots: await Promise.all(
        rows.map(async (spot) => ({
          ...spot,
          // A link, so a phone camera app can open it without the in-app
          // scanner. Signed per spot; see lib/qr.ts.
          code: origin + stampPath(spot.id, await qrSignature(spot.id)),
        })),
      ),
    });
  },
);

const text = (value: unknown) =>
  (typeof value === 'string' ? value : '').trim();

export const POST = route(
  'POST /api/admin/spots',
  '設置場所を保存できませんでした。',
  async (request) => {
    const session = await requireAdmin(request, { mutation: true });
    // An uploaded icon travels inline with the location, so this route
    // accepts more than the default 8KB body.
    const data = await bodyJson(request, maxSpotIconLength + 8192);
    const now = nowSeconds();
    if (data.action === 'seed') {
      await writeBatch([
        ...seedSpotStatements(),
        auditStatement('seed_spots', event.id, session.actor, now),
      ]);
      return json({ ok: true });
    }
    const id =
      typeof data.id === 'string' ? data.id : 'spot-' + crypto.randomUUID();
    const name = text(data.name);
    const location = text(data.location);
    const description = text(data.description);
    const icon = text(data.icon);
    const sortOrder = Number(data.sortOrder ?? 0);
    const active = data.active === true || data.active === 1 ? 1 : 0;
    if (!validSpotIcon(icon))
      throw new UserError(
        'アイコンを確認してください。画像はPNGかJPEGで、小さいものを選んでください。',
      );
    if (
      !validId(id) ||
      !name ||
      name.length > 60 ||
      !location ||
      location.length > 80 ||
      description.length > 160 ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 999
    )
      throw new UserError('名称・場所・表示順を確認してください。');
    const values = {
      name,
      location,
      description,
      icon,
      sortOrder,
      active,
      updatedAt: now,
    };
    await writeBatch([
      db()
        .insert(locations)
        .values({ id, eventId: event.id, ...values })
        .onConflictDoUpdate({
          target: locations.id,
          set: values,
          // An id belongs to one festival; another festival's row is never
          // overwritten through this one's console.
          setWhere: sql`${locations.eventId} = ${event.id}`,
        }),
      auditStatement('save_spot', id, session.actor, now),
    ]);
    return json({ ok: true });
  },
);
