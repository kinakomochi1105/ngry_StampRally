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
    createdAt: integer('created_at').notNull(),
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
