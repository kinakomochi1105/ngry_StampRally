import { mapImage } from '@/lib/data';
import { gate } from '@/lib/gate';
import { imageResponse } from '@/lib/map-image';
import { json, logFailure } from '@/lib/server';

/**
 * One venue map's picture. The screen asks for it with the map's `updatedAt`
 * in the query, so a new picture is never taken from the browser's cache.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const closed = await gate(request);
    if (closed) return closed;
    const { id } = await params;
    if (!/^[a-z0-9-]{1,64}$/.test(id))
      return new Response('Not found', { status: 404 });
    return imageResponse(await mapImage(id), 3600);
  } catch (e) {
    logFailure('GET /api/map/[id]', e);
    return json({ error: '会場マップを読み込めませんでした。' }, 503);
  }
}
