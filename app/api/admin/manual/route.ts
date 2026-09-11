import { json, logFailure } from '@/lib/server';
import { guard } from '@/lib/admin';
import { manualIndex, manualPage, searchManual } from '@/lib/manual';
/**
 * The manual is administrator-only, so it is served through the admin API like
 * every other protected view: the admin cookie is scoped to `/api/admin`, which
 * a page under `/admin` could not read on the server anyway.
 */
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const query = url.searchParams.get('q');
  try {
    if (slug) {
      const page = await manualPage(slug);
      if (!page) return json({ error: 'マニュアルが見つかりません。' }, 404);
      return json({ page });
    }
    if (query !== null && query.trim())
      return json({ results: await searchManual(query.slice(0, 80)) });
    return json(await manualIndex());
  } catch (e) {
    logFailure('GET /api/admin/manual', e);
    return json(
      {
        error:
          e instanceof Error && e.message.startsWith('content/manual/')
            ? // A broken page is an editing mistake, so the file name and the
              // reason are worth showing to the administrator reading it.
              e.message
            : 'マニュアルを読み込めませんでした。',
      },
      503,
    );
  }
}
