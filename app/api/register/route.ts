import { sql } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { guestSequence, participants } from '@/db/schema';
import { studentFields } from '@/lib/data';
import { event } from '@/lib/event';
import { checkNickname } from '@/lib/forbidden';
import { requireGate } from '@/lib/gate';
import {
  bodyJson,
  clientAddress,
  isUniqueViolation,
  json,
  nowSeconds,
  requireSameOrigin,
  route,
  UserError,
} from '@/lib/http';
import { enforce, limitKey, limits } from '@/lib/limits';
import { makeRecovery } from '@/lib/recovery';
import { currentParticipant, newParticipant } from '@/lib/session';
import { configuration } from '@/lib/settings';

export const POST = route(
  'POST /api/register',
  '登録を完了できませんでした。時間をおいて再試行してください。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const data = await bodyJson(request);
    const config = await configuration();
    if (!config.registrationOpen)
      throw new UserError('ただいま新規受付を停止しています。', 409);
    if (await currentParticipant(request)) return json({ ok: true });
    if (data.kind !== 'student' && data.kind !== 'guest')
      throw new UserError('生徒または一般客を選んでください。');
    const name = await checkNickname(data.nickname, config);
    const profile =
      data.kind === 'student' ? studentFields(data, config) : null;
    // Counted only once the form is valid, so a typo costs nothing; what is
    // limited is how many passes one connection can create.
    await enforce(
      await limitKey('register', clientAddress(request)),
      limits.register,
      '短時間に多くの登録がありました。しばらくしてからお試しください。',
    );
    const recovery = await makeRecovery();
    const created = await newParticipant(request);
    const now = nowSeconds();
    const common = {
      eventId: event.id,
      hash: created.hash,
      createdAt: now,
      nickname: name.nickname,
      nicknameKey: name.key,
      recoveryHash: recovery.hash,
    };
    try {
      if (profile)
        await db()
          .insert(participants)
          .values({ ...common, kind: 'student', ...profile });
      else
        // The next number is taken in the same transaction as the insert, so
        // two guests registering at once never share one.
        await writeBatch([
          db()
            .insert(guestSequence)
            .values({ eventId: event.id, nextNumber: 1 })
            .onConflictDoUpdate({
              target: guestSequence.eventId,
              set: { nextNumber: sql`${guestSequence.nextNumber} + 1` },
            }),
          sql`INSERT INTO participants (event_id,hash,kind,guest_number,created_at,nickname,nickname_key,recovery_hash)
 SELECT ${common.eventId},${common.hash},'guest',next_number,${now},${common.nickname},${common.nicknameKey},${common.recoveryHash}
 FROM guest_sequence WHERE event_id=${event.id}`,
        ]);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new UserError(
          'この学年・組・出席番号は登録済みです。元のブラウザで開くか、受付で管理者にご相談ください。',
          409,
        );
      throw error;
    }
    return json(
      { ok: true, nickname: name.nickname, recoveryCode: recovery.code },
      201,
      { 'Set-Cookie': created.cookie },
    );
  },
);
