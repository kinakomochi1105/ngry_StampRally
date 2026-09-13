import { requireAdmin } from '@/lib/admin';
import { mapImage, validId } from '@/lib/data';
import { route } from '@/lib/http';
import { imageResponse } from '@/lib/map-image';

/**
 * The picture behind one map, for the editor. The participant route cannot
 * serve the console: the organiser's cookie is scoped to /api/admin, and an
 * unpublished map is not readable through the participant route at all.
 */
export const GET = route<{ params: Promise<{ id: string }> }>(
  'GET /api/admin/maps/[id]',
  '会場マップを読み込めませんでした。',
  async (request, { params }) => {
    await requireAdmin(request);
    const { id } = await params;
    // 0: the editor always asks for the picture it is about to draw on.
    return imageResponse(validId(id) ? await mapImage(id, false) : null, 0);
  },
);
