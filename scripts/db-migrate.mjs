// Applies the migrations in drizzle/ to the database named by the environment,
// and says out loud which database it touched and what changed. `drizzle-kit
// migrate` reads its URL through a config file that falls back to the local
// SQLite file, so a mistyped or unexported variable silently migrates
// local.db instead of Turso; this script refuses to guess.
//
//   $env:TURSO_DATABASE_URL='libsql://<db>.turso.io'
//   $env:TURSO_AUTH_TOKEN='<token>'
//   node scripts/db-migrate.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
// `--if-configured` is for the build step (`npm run build`, which runs this
// after `next build` succeeds).
const onBuild = process.argv.includes('--if-configured');
const vercelEnv = process.env.VERCEL_ENV;

if (onBuild && vercelEnv && vercelEnv !== 'production') {
  // A preview deployment is built from an unmerged branch. If it shares the
  // production database's variables, migrating here would change the schema
  // under the live site before the branch is reviewed. A preview with its own
  // database opts in with MIGRATE_PREVIEW_DATABASE=1.
  if (process.env.MIGRATE_PREVIEW_DATABASE !== '1') {
    console.log(
      `db-migrate: skipped on a ${vercelEnv} deployment (set MIGRATE_PREVIEW_DATABASE=1 for a preview-only database).`,
    );
    process.exit(0);
  }
}

if (!url) {
  // A checkout with no database still builds, while a production build
  // without one stops rather than shipping code that cannot read its tables.
  if (onBuild && vercelEnv !== 'production') {
    console.log('db-migrate: no TURSO_DATABASE_URL, skipping migrations.');
    process.exit(0);
  }
  console.error(
    'TURSO_DATABASE_URL is not set in this shell. Set it and the token first:\n' +
      "  $env:TURSO_DATABASE_URL='libsql://<db>.turso.io'\n" +
      "  $env:TURSO_AUTH_TOKEN='<token>'",
  );
  process.exit(1);
}
if (url.startsWith('libsql://') && !authToken) {
  console.error(
    'TURSO_AUTH_TOKEN is not set, so Turso would refuse the connection.',
  );
  process.exit(1);
}

const client = createClient({ url, authToken });
const applied = async () => {
  try {
    const result = await client.execute(
      'SELECT COUNT(*) FROM __drizzle_migrations',
    );
    return Number(result.rows[0][0]);
  } catch {
    // The table only exists once a migration has run against this database.
    return 0;
  }
};
const rows = async (table) => {
  try {
    const result = await client.execute('SELECT COUNT(*) FROM ' + table);
    return Number(result.rows[0][0]);
  } catch {
    return 'n/a';
  }
};

const expected = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
  .entries.length;

console.log('database : ' + url);
console.log(
  'token    : ' + (authToken ? 'set (' + authToken.length + ' chars)' : 'none'),
);
console.log('applied  : ' + (await applied()) + ' migration(s) before');
// A production database has the real locations and participants in it; an
// empty one is a sign that this is the local file or a spare database.
console.log(
  'contents : ' +
    (await rows('locations')) +
    ' locations, ' +
    (await rows('participants')) +
    ' participants',
);

await migrate(drizzle(client), { migrationsFolder: 'drizzle' });

const after = await applied();
console.log('applied  : ' + after + ' migration(s) after');
if (after < expected) {
  console.error(
    `WARNING: ${expected} migrations exist in drizzle/, but this database records ${after}.`,
  );
  process.exit(1);
}
console.log(`OK: all ${expected} migrations are applied to this database.`);
