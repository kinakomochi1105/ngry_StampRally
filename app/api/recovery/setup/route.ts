import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { participants } from '@/db/schema';
import { event } from '@/lib/event';
import { checkNickname } from '@/lib/forbidden';
import { requireGate } from '@/lib/gate';
import {
  bodyJson,
  json,
  requireSameOrigin,
  route,
  UserError,
} from '@/lib/http';
import { nicknameKey } from '@/lib/nickname';
import { makeRecovery } from '@/lib/recovery';
import { requireParticipant } from '@/lib/session';
import { configuration } from '@/lib/settings';

/** Issues a new recovery code (and, for an older pass, its first nickname). */
export const POST = route(
  'POST /api/recovery/setup',
  '復旧コードを発行できませんでした。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const person = await requireParticipant(request, 'ログインが必要です。');
    const data = await bodyJson(request, 2048);
    // Existing names remain usable even if the organizer later adds a blocked word.
    const name = person.nickname
      ? { nickname: person.nickname, key: nicknameKey(person.nickname) }
      : await checkNickname(data.nickname, await configuration());
    const recovery = await makeRecovery();
    const result = await db()
      .update(participants)
      .set({
        nickname: name.nickname,
        nicknameKey: name.key,
        recoveryHash: recovery.hash,
      })
      .where(
        and(
          eq(participants.id, person.id),
          eq(participants.eventId, event.id),
          eq(participants.hash, person.hash),
        ),
      );
    if (result.rowsAffected !== 1)
      throw new UserError('ページを開き直してください。', 409);
    return json({ nickname: name.nickname, recoveryCode: recovery.code });
  },
);
