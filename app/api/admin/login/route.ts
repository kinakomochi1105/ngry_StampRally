import {
  actorName,
  adminCookie,
  deviceLabel,
  minimumAdminPassword,
  type AdminRole,
} from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { safeEqual, sign } from '@/lib/crypto';
import { env } from '@/lib/env';
import {
  bodyJson,
  clientAddress,
  json,
  requireSameOrigin,
  route,
  UserError,
} from '@/lib/http';
import { enforce, forgetStatement, limitKey, limits } from '@/lib/limits';
import { hashSecret, secretHash } from '@/lib/settings';

/**
 * Signs a console device in. The admin password opens everything; the desk
 * password, when an admin has set one, opens the reward desk only.
 */
export const POST = route(
  'POST /api/admin/login',
  'ログインできませんでした。',
  async (request) => {
    requireSameOrigin(request);
    if (env.ADMIN_PASSWORD.length < minimumAdminPassword)
      throw new UserError('管理者パスワードが未設定です。', 503);
    const data = await bodyJson(request, 1024);
    const bucket = await limitKey('admin-login', clientAddress(request));
    await enforce(bucket, limits.adminLogin);
    const password = typeof data.password === 'string' ? data.password : '';
    let role: AdminRole | null = null;
    // Compared as HMACs, so the comparison takes the same time whatever the
    // lengths of the two passwords.
    if (
      safeEqual(
        await sign('password:' + password),
        await sign('password:' + env.ADMIN_PASSWORD),
      )
    )
      role = 'admin';
    else {
      const desk = await secretHash('desk-password');
      if (desk && safeEqual(await hashSecret('desk-password', password), desk))
        role = 'desk';
    }
    if (!role) throw new UserError('パスワードが違います。', 401);
    const label = deviceLabel(data.label);
    await forgetStatement(bucket);
    await auditStatement(role + '_login', role, actorName(role, label));
    return json({ ok: true, role, label }, 200, {
      'Set-Cookie': await adminCookie(request, role, label),
    });
  },
);
