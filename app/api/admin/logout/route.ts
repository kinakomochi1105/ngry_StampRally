import { clearAdminCookie } from '@/lib/admin';
import { json, requireSameOrigin, route } from '@/lib/http';

export const POST = route(
  'POST /api/admin/logout',
  'ログアウトできませんでした。',
  async (request) => {
    requireSameOrigin(request);
    return json({ ok: true }, 200, {
      'Set-Cookie': clearAdminCookie(request),
    });
  },
);
