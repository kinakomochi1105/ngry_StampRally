// Applies the migrations in drizzle/ to the database named by the environment,
// and says out loud which database it touched and what changed. `drizzle-kit
// migrate` reads its URL through a config file that falls back to the local
// SQLite file, so a mistyped or unexported variable silently migrates
// local.db instead of Turso; this script refuses to guess.
//
//   $env:TURSO_DATABASE_URL='libsql://<db>.turso.io'
//   $env:TURSO_AUTH_TOKEN='<token>'
//   node scripts/db-migrate.mjs
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
// `--if-configured` is for the build step: a checkout with no database still
// builds, while a production build without one stops rather than shipping code
// that cannot read its own tables.
const optional = process.argv.includes('--if-configured');
if (!url) {
  if (optional && process.env.VERCEL_ENV !== 'production') {
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
const columns = async () => {
  const result = await client.execute('PRAGMA table_info(locations)');
  // PRAGMA returns cid, name, type, ... per column; the name is index 1.
  return result.rows.map((row) => JSON.stringify(row[1]).replaceAll('"', ''));
};
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

console.log('database : ' + url);
console.log(
  'token    : ' + (authToken ? 'set (' + authToken.length + ' chars)' : 'none'),
);
const before = await applied();
console.log('applied  : ' + before + ' migration(s) before');
console.log('locations: ' + (await columns()).join(', '));
// A production database has the real locations and participants in it; an
// empty one is a sign that this is the local file or a spare database.
console.log(
  'contents: ' +
    (await rows('locations')) +
    ' locations, ' +
    (await rows('participants')) +
    ' participants',
);

await migrate(drizzle(client), { migrationsFolder: 'drizzle' });

const after = await applied();
const now = await columns();
console.log('applied  : ' + after + ' migration(s) after');
console.log('locations: ' + now.join(', '));
console.log(
  now.includes('icon')
    ? 'OK: locations.icon exists on this database.'
    : 'WARNING: locations.icon is still missing - this is not the database the site uses.',
);
