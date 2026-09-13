import { mapImage, validId } from '@/lib/data';
import { requireGate } from '@/lib/gate';
import { route } from '@/lib/http';
import { imageResponse } from '@/lib/map-image';

/**
 * One venue map's picture. The screen asks for it with the map's `updatedAt`
 * in the query, so a new picture is never taken from the browser's cache.
 */
export const GET = route<{ params: Promise<{ id: string }> }>(
  'GET /api/map/[id]',
  '会場マップを読み込めませんでした。',
  async (request, { params }) => {
    await requireGate(request);
    const { id } = await params;
    return imageResponse(validId(id) ? await mapImage(id) : null, 3600);
  },
);
