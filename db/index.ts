import { createClient, type Client, type InValue } from '@libsql/client';
import { is, SQL } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core';

// libSQL (Turso in production, a local SQLite file in development), queried
// through Drizzle so column names and result types come from db/schema.ts.

let connection: { client: Client; db: LibSQLDatabase } | undefined;

function open() {
  if (connection) return connection;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('Database unavailable');
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  connection = { client, db: drizzle(client) };
  return connection;
}

/** The database, opened on first use so a missing URL is a handled failure. */
export const db = () => open().db;

type Statement = SQL | { toSQL(): { sql: string; params: unknown[] } };

const dialect = new SQLiteAsyncDialect();

/**
 * Runs the statements as one write transaction. Drizzle's own `batch()` opens
 * a deferred transaction, which a concurrent writer can turn into
 * SQLITE_BUSY halfway through; 'write' takes the lock up front instead.
 */
export async function writeBatch(statements: Statement[]) {
  return open().client.batch(
    statements.map((statement) => {
      const query = is(statement, SQL)
        ? dialect.sqlToQuery(statement)
        : statement.toSQL();
      return { sql: query.sql, args: query.params as InValue[] };
    }),
    'write',
  );
}
