import { and, eq, exists } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import { participants, stamps } from '@/db/schema';
import { event } from '@/lib/event';
import { requireGate } from '@/lib/gate';
import { json, requireSameOrigin, route } from '@/lib/http';
import {
  clearParticipantCookie,
  currentParticipant,
  newParticipant,
} from '@/lib/session';

/**
 * Signs this browser out. The participant and their stamps move to a fresh
 * hash nobody holds, so the cookie is dead on the server too, while the
 * nickname and recovery code can still bring the pass back on any device.
 */
export const POST = route(
  'POST /api/logout',
  'ログアウトを完了できませんでした。再試行してください。',
  async (request) => {
    requireSameOrigin(request);
    await requireGate(request);
    const person = await currentParticipant(request);
    if (person) {
      const next = await newParticipant(request);
      await writeBatch([
        // Guarded by the participant still holding this hash, so a sign-in on
        // another device in between cannot leave the stamps behind.
        db()
          .update(stamps)
          .set({ participantHash: next.hash })
          .where(
            and(
              eq(stamps.eventId, event.id),
              eq(stamps.participantHash, person.hash),
              exists(
                db()
                  .select({ id: participants.id })
                  .from(participants)
                  .where(
                    and(
                      eq(participants.id, person.id),
                      eq(participants.eventId, event.id),
                      eq(participants.hash, person.hash),
                    ),
                  ),
              ),
            ),
          ),
        db()
          .update(participants)
          .set({ hash: next.hash })
          .where(
            and(
              eq(participants.id, person.id),
              eq(participants.eventId, event.id),
              eq(participants.hash, person.hash),
            ),
          ),
      ]);
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': clearParticipantCookie(request),
    });
  },
);
