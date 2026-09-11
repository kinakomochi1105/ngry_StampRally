import { env } from './env';
import { sign, safeEqual, json, validOrigin, isSecureRequest } from './server';
export async function admin(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('rally_admin='))
    ?.slice(12);
  if (!value || !env.ADMIN_PASSWORD) return false;
  const [expires, nonce, signature] = value.split('.');
  if (
    !/^\d{10}$/.test(expires) ||
    Number(expires) <= Date.now() / 1000 ||
    !/^[a-f0-9]{32}$/.test(nonce ?? '')
  )
    return false;
  return safeEqual(
    signature ?? '',
    await sign(`admin:${expires}:${nonce}:${env.ADMIN_PASSWORD}`),
  );
}
export async function adminCookie(request: Request) {
  const expires = Math.floor(Date.now() / 1000) + 8 * 3600;
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const signature = await sign(
    `admin:${expires}:${nonce}:${env.ADMIN_PASSWORD}`,
  );
  return `rally_admin=${expires}.${nonce}.${signature}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${isSecureRequest(request) ? '; Secure' : ''}`;
}
export async function guard(request: Request, mutation = false) {
  if (!(await admin(request)))
    return json({ error: '管理者ログインが必要です。' }, 401);
  if (mutation && !validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  return null;
}
