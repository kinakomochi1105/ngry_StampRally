import { database } from '@/db';
import { event } from '@/lib/event';
import { json, participant, verifyQr, validOrigin } from '@/lib/server';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json({ error: 'ページを開き直してお試しください。' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: '読み取りデータが正しくありません。' }, 415);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'QRデータがありません。' }, 400);
    let text = '';
    let size = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return json({ error: 'QRデータが長すぎます。' }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'QRデータが正しくありません。' }, 400);
    }
    const hash = await participant(request);
    if (!hash)
      return json(
        { error: 'スタンプ帳を再読み込みしてからお試しください。' },
        401,
      );
    const spotId = await verifyQr(body?.code);
    if (!spotId)
      return json(
        {
          error:
            'この文化祭のQRではありません。設置されたQRを読み取ってください。',
        },
        400,
      );
    const result = await database()
      .prepare(
        'INSERT INTO stamps (event_id, participant_hash, spot_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, participant_hash, spot_id) DO NOTHING',
      )
      .bind(event.id, hash, spotId, Math.floor(Date.now() / 1000))
      .run();
    return json({ spotId, duplicate: result.meta.changes === 0 });
  } catch {
    return json(
      {
        error:
          '押印を確認できませんでした。通信が戻ったら同じQRで再試行できます。',
      },
      503,
    );
  }
}
