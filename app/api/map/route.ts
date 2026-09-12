import { allMaps } from '@/lib/data';
import { gate } from '@/lib/gate';
import { json, logFailure } from '@/lib/server';

/**
 * The venue maps a participant can open: their names, their proportions and
 * the areas drawn on them. The pictures are not here — each one is fetched
 * from /api/map/<id> so the browser can cache it.
 */
export async function GET(request: Request) {
  try {
    const closed = await gate(request);
    if (closed) return closed;
    return json({ maps: await allMaps() });
  } catch (e) {
    logFailure('GET /api/map', e);
    return json({ error: '会場マップを読み込めませんでした。' }, 503);
  }
}
