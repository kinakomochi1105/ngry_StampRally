import {
  createClient,
  type Client,
  type InValue,
  type ResultSet,
} from '@libsql/client';

// The application was written against Cloudflare D1. Vercel has no D1, so the
// database is now libSQL (Turso), which speaks the same SQLite dialect and runs
// the same migrations. This adapter keeps D1's statement API —
// `prepare().bind().first()/all()/run()` and `batch()` — so every query in the
// app is unchanged.

let client: Client | undefined;

function connection() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('Database unavailable');
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

// libSQL hands back array-like rows plus a separate column list; D1 hands back
// plain objects, which is what the callers index into.
function rows<T>(result: ResultSet) {
  return result.rows.map(
    (row) =>
      Object.fromEntries(
        result.columns.map((column, index) => [column, row[index]]),
      ) as T,
  );
}

function meta(result: ResultSet) {
  return {
    changes: result.rowsAffected,
    last_row_id: Number(result.lastInsertRowid ?? 0),
    duration: 0,
  };
}

function answer<T>(result: ResultSet) {
  return { results: rows<T>(result), success: true, meta: meta(result) };
}

class Statement {
  constructor(
    readonly sql: string,
    readonly args: InValue[] = [],
  ) {}
  // D1's bind() returns a new statement rather than mutating this one, and the
  // batch call sites rely on that.
  bind(...args: InValue[]) {
    return new Statement(this.sql, args);
  }
  query() {
    return { sql: this.sql, args: this.args };
  }
  async first<T = Record<string, unknown>>() {
    const result = await connection().execute(this.query());
    return rows<T>(result)[0] ?? null;
  }
  async all<T = Record<string, unknown>>() {
    return answer<T>(await connection().execute(this.query()));
  }
  async run() {
    return answer<Record<string, unknown>>(
      await connection().execute(this.query()),
    );
  }
}

export function database() {
  return {
    prepare: (sql: string) => new Statement(sql),
    // 'write' runs the statements inside one transaction, matching D1's batch.
    batch: async <T = Record<string, unknown>>(statements: Statement[]) =>
      (
        await connection().batch(
          statements.map((statement) => statement.query()),
          'write',
        )
      ).map((result) => answer<T>(result)),
  };
}
