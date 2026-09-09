import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const stamps = sqliteTable(
  'stamps',
  {
    eventId: text('event_id').notNull(),
    participantHash: text('participant_hash').notNull(),
    spotId: text('spot_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.eventId, table.participantHash, table.spotId],
    }),
    index('stamps_created_at_idx').on(table.createdAt),
  ],
);
