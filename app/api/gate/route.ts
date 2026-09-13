import { gateRequired, openGate } from '@/lib/gate';
import { bodyJson, json, requireSameOrigin, route } from '@/lib/http';

/** Whether this festival asks for a word before its screens will answer. */
export const GET = route(
  'GET /api/gate',
  '合言葉の設定を確認できませんでした。',
  async () => json({ required: await gateRequired() }),
);

/** Exchanges the word for the pass cookie the participant APIs look for. */
export const POST = route(
  'POST /api/gate',
  '合言葉を確認できませんでした。',
  async (request) => {
    requireSameOrigin(request);
    const data = await bodyJson(request, 1024);
    const cookie = await openGate(request, data.password);
    return json({ ok: true }, 200, cookie ? { 'Set-Cookie': cookie } : {});
  },
);
