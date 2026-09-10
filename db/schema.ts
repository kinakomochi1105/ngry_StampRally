import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
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

// Anonymous, short-lived activity samples used only for the public congestion hint.
// No participant identifier is stored here; the stamp history remains in `stamps`.
export const spotActivity = sqliteTable(
  'spot_activity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: text('event_id').notNull(),
    spotId: text('spot_id').notNull(),
    accessedAt: integer('accessed_at').notNull(),
  },
  (table) => [
    index('spot_activity_recent_idx').on(
      table.eventId,
      table.spotId,
      table.accessedAt,
    ),
  ],
);

export const participants = sqliteTable(
  'participants',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: text('event_id').notNull(),
    hash: text('hash').notNull(),
    kind: text('kind').notNull(),
    grade: text('grade'),
    className: text('class_name'),
    number: integer('number'),
    guestNumber: integer('guest_number'),
    nickname: text('nickname'),
    nicknameKey: text('nickname_key'),
    recoveryHash: text('recovery_hash'),
    createdAt: integer('created_at').notNull(),
    // Reward hand-over. `completedAt` is the last stamp at the moment staff
    // confirmed, kept separately so later spot changes cannot rewrite history.
    completedAt: integer('completed_at'),
    redeemedAt: integer('redeemed_at'),
  },
  (t) => [
    uniqueIndex('participants_hash_idx').on(t.eventId, t.hash),
    uniqueIndex('participants_student_idx').on(
      t.eventId,
      t.grade,
      t.className,
      t.number,
    ),
    uniqueIndex('participants_guest_idx').on(t.eventId, t.guestNumber),
    uniqueIndex('participants_recovery_idx').on(t.eventId, t.recoveryHash),
  ],
);
export const locations = sqliteTable(
  'locations',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    name: text('name').notNull(),
    location: text('location').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active').notNull().default(1),
  },
  (t) => [index('locations_event_idx').on(t.eventId, t.active, t.sortOrder)],
);
export const settings = sqliteTable('settings', {
  eventId: text('event_id').primaryKey(),
  value: text('value').notNull(),
});
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(),
  target: text('target').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const guestSequence = sqliteTable('guest_sequence', {
  eventId: text('event_id').primaryKey(),
  nextNumber: integer('next_number').notNull(),
});
