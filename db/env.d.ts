// Values the server reads from the process environment. On Vercel these are
// project environment variables; locally they come from `.env`.
declare namespace NodeJS {
  interface ProcessEnv {
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    RALLY_SECRET?: string;
    ADMIN_PASSWORD?: string;
  }
}
