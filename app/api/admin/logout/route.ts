import { json, validOrigin } from '@/lib/server';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'アクセスできません。' }, 403);
  return json({ ok: true }, 200, {
    'Set-Cookie':
      'rally_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0',
  });
}
