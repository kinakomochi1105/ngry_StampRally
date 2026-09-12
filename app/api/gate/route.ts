import { bodyJson } from '@/lib/data';
import { json, validOrigin } from '@/lib/server';
import { gateRequired, openGate } from '@/lib/gate';

/** Whether this festival asks for a word before its screens will answer. */
export async function GET() {
  return json({ required: await gateRequired() });
}

/** Exchanges the word for the pass cookie the participant APIs look for. */
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してください。' }, 403);
  try {
    const data = await bodyJson(request, 1024);
    const result = await openGate(request, data.password);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json(
      { ok: true },
      200,
      result.cookie ? { 'Set-Cookie': result.cookie } : {},
    );
  } catch {
    return json({ error: '合言葉を確認できませんでした。' }, 400);
  }
}
