import { requireAdmin } from '@/lib/admin';
import { json, route, UserError } from '@/lib/http';
import { manualIndex, manualPage, searchManual } from '@/lib/manual';

/**
 * The manual is for staff, so it is served through the admin API like every
 * other protected view: the admin cookie is scoped to `/api/admin`, which a
 * page under `/admin` could not read on the server anyway. Desk devices may
 * read it too; it holds procedures, not participant data.
 */
export const GET = route(
  'GET /api/admin/manual',
  'マニュアルを読み込めませんでした。',
  async (request) => {
    await requireAdmin(request, { roles: ['admin', 'desk'] });
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const query = url.searchParams.get('q');
    try {
      if (slug) {
        const page = await manualPage(slug);
        if (!page) throw new UserError('マニュアルが見つかりません。', 404);
        return json({ page });
      }
      if (query !== null && query.trim())
        return json({ results: await searchManual(query.slice(0, 80)) });
      return json(await manualIndex());
    } catch (error) {
      // A broken page is an editing mistake, so the file name and the reason
      // are worth showing to the administrator reading it.
      if (error instanceof Error && error.message.startsWith('content/manual/'))
        throw new UserError(error.message, 503);
      throw error;
    }
  },
);
