import { requireAdmin } from '@/lib/admin';
import { json, route } from '@/lib/http';

/** Who this console device is signed in as, so the screen shows only what that role may use. */
export const GET = route(
  'GET /api/admin/session',
  'ログイン状態を確認できませんでした。',
  async (request) => {
    const session = await requireAdmin(request, { roles: ['admin', 'desk'] });
    return json({ role: session.role, label: session.label });
  },
);
