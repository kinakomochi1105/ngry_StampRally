import { allMaps } from '@/lib/data';
import { requireGate } from '@/lib/gate';
import { json, route } from '@/lib/http';

/**
 * The venue maps a participant can open: their names, their proportions and
 * the areas drawn on them. The pictures are not here — each one is fetched
 * from /api/map/<id> so the browser can cache it.
 */
export const GET = route(
  'GET /api/map',
  '会場マップを読み込めませんでした。',
  async (request) => {
    await requireGate(request);
    return json({ maps: await allMaps() });
  },
);
