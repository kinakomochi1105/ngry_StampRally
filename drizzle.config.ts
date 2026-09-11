import { defineConfig } from 'drizzle-kit';

// Migrations are plain SQLite, so the same files that ran on D1 run on libSQL.
// `file:` keeps `drizzle-kit generate` working without any credentials.
export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
