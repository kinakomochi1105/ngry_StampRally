import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { json, sign, safeEqual, validOrigin } from '@/lib/server';
import { bodyJson, audit } from '@/lib/data';
import { adminCookie } from '@/lib/admin';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16)
      return json({ error: '管理者パスワードが未設定です。' }, 503);
    const data = await bodyJson(request, 1024);
    const now = Math.floor(Date.now() / 1000);
    // Cloudflare overwrites this header. Local development uses one shared bucket.
    const bucket = await sign(
      'login:' + (request.headers.get('cf-connecting-ip') ?? 'local'),
    );
    const result = await database()
      .prepare(
        'INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts',
      )
      .bind(bucket, now + 900, now, now, now + 900)
      .first<{ attempts: number }>();
    if ((result?.attempts ?? 99) > 10)
      return json(
        { error: '試行回数が多いため、15分後にお試しください。' },
        429,
      );
    if (
      typeof data.password !== 'string' ||
      !safeEqual(
        await sign('password:' + data.password),
        await sign('password:' + env.ADMIN_PASSWORD),
      )
    )
      return json({ error: 'パスワードが違います。' }, 401);
    await database()
      .prepare('DELETE FROM login_attempts WHERE key=? OR expires_at<=?')
      .bind(bucket, now)
      .run();
    await audit('admin_login', 'admin');
    return json({ ok: true }, 200, {
      'Set-Cookie': await adminCookie(request),
    });
  } catch {
    return json({ error: 'ログインできませんでした。' }, 400);
  }
}
