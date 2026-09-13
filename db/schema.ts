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

// What participants themselves say about a spot, on the same anonymous terms
// as `spotActivity`: the level and the time, never who sent it. Repeat reports
// are held off with a short-lived key in `loginAttempts` instead, so no
// identifier has to be stored beside the reading.
export const spotReports = sqliteTable(
  'spot_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: text('event_id').notNull(),
    spotId: text('spot_id').notNull(),
    /** 1 = quiet, 2 = some activity, 3 = busy. */
    level: integer('level').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('spot_reports_recent_idx').on(
      table.eventId,
      table.spotId,
      table.createdAt,
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
    // Either a template key ("flag", "palette", ...) or a small PNG/JPEG data
    // URL uploaded by the organiser. Empty means the default for its position.
    icon: text('icon').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active').notNull().default(1),
    // Bumped on every save. An uploaded icon is served from its own URL that
    // carries this value, so a replaced icon never comes from a browser cache.
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [index('locations_event_idx').on(t.eventId, t.active, t.sortOrder)],
);
// A picture of the venue the organiser uploads, plus the areas drawn over it.
// Each area points at a location, so a visitor can tap the room on the map and
// get to that group's entry.
export const venueMaps = sqliteTable(
  'venue_maps',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    name: text('name').notNull(),
    /** A PNG/JPEG data URL, scaled down in the browser before it is sent. */
    image: text('image').notNull(),
    /** The picture's own pixel size, which fixes the aspect ratio. */
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    /** JSON: [{ id, spotId, label, x, y, w, h }], x/y/w/h as 0-1 fractions. */
    areas: text('areas').notNull().default('[]'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active').notNull().default(1),
    // Bumped on every save. The picture's URL carries it, so a replaced
    // picture is never served from a browser cache.
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [index('venue_maps_event_idx').on(t.eventId, t.active, t.sortOrder)],
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
  /** Who did it: the role and the device name given at sign-in, e.g. 'desk:受付1'. */
  actor: text('actor').notNull().default(''),
  createdAt: integer('created_at').notNull(),
});

export const guestSequence = sqliteTable('guest_sequence', {
  eventId: text('event_id').primaryKey(),
  nextNumber: integer('next_number').notNull(),
});
