import { spotIcon, validId } from '@/lib/data';
import { requireGate } from '@/lib/gate';
import { route } from '@/lib/http';
import { imageResponse } from '@/lib/map-image';

/**
 * One location's uploaded icon. The passport lists its URL with the
 * location's `updatedAt` in the query, so the picture is sent once per change
 * instead of inside every minute's passport refresh.
 */
export const GET = route<{ params: Promise<{ id: string }> }>(
  'GET /api/spot-icon/[id]',
  'アイコンを読み込めませんでした。',
  async (request, { params }) => {
    await requireGate(request);
    const { id } = await params;
    return imageResponse(validId(id) ? await spotIcon(id) : null, 86400);
  },
);
