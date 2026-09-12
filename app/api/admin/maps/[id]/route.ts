import { guard } from '@/lib/admin';
import { mapImage } from '@/lib/data';
import { imageResponse } from '@/lib/map-image';
import { json, logFailure } from '@/lib/server';

/**
 * The picture behind one map, for the editor. The participant route cannot
 * serve the console: the organiser's cookie is scoped to /api/admin, and an
 * unpublished map is not readable through the participant route at all.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!/^[a-z0-9-]{1,64}$/.test(id))
      return new Response('Not found', { status: 404 });
    // 0: the editor always asks for the picture it is about to draw on.
    return imageResponse(await mapImage(id, false), 0);
  } catch (e) {
    logFailure('GET /api/admin/maps/[id]', e);
    return json({ error: '会場マップを読み込めませんでした。' }, 503);
  }
}
