import { database } from '@/db';
import { event } from '@/lib/event';
import {
  json,
  participant,
  newParticipant,
  retentionSeconds,
} from '@/lib/server';
export async function GET(request: Request) {
  try {
    let hash = await participant(request);
    let cookie: string | undefined;
    if (!hash) {
      const created = await newParticipant(request);
      hash = created.hash;
      cookie = created.cookie;
    }
    const result = await database()
      .prepare(
        'SELECT spot_id AS spotId, created_at AS createdAt FROM stamps WHERE event_id = ? AND participant_hash = ? AND created_at > ?',
      )
      .bind(event.id, hash, Math.floor(Date.now() / 1000) - retentionSeconds)
      .all();
    return json(
      { stamps: result.results },
      200,
      cookie ? { 'Set-Cookie': cookie } : {},
    );
  } catch {
    return json(
      {
        error:
          'スタンプ帳を読み込めませんでした。通信を確認して、もう一度お試しください。',
      },
      503,
    );
  }
}
