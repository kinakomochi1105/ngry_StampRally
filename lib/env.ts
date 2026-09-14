// Read at request time rather than at module load, so a missing value surfaces
// as a handled 503 with a log line instead of a crash on import.
export const env = {
  get RALLY_SECRET() {
    return process.env.RALLY_SECRET ?? '';
  },
  /** Public address printed into QR links, e.g. https://rally.example.jp */
  get RALLY_SITE_URL() {
    return process.env.RALLY_SITE_URL ?? '';
  },
  get ADMIN_PASSWORD() {
    return process.env.ADMIN_PASSWORD ?? '';
  },
  /** AES-256 key (32 bytes) that `Config/forbidden` is encrypted with. */
  get NICKNAME_BLOCKLIST_KEY() {
    return process.env.NICKNAME_BLOCKLIST_KEY ?? '';
  },
  /** AES-CBC IV (16 bytes) that `Config/forbidden` is encrypted with. */
  get NICKNAME_BLOCKLIST_IV() {
    return process.env.NICKNAME_BLOCKLIST_IV ?? '';
  },
  /** Optional path to an encrypted blocklist other than Config/forbidden (CI). */
  get NICKNAME_BLOCKLIST_PATH() {
    return process.env.NICKNAME_BLOCKLIST_PATH ?? '';
  },
  /** `1` answers every participant page and API with 503 (lib/maintenance.ts). */
  get MAINTENANCE_MODE() {
    return process.env.MAINTENANCE_MODE === '1';
  },
  /** Set by Vercel on every deployment; its edge rewrites the forwarded headers. */
  get VERCEL() {
    return process.env.VERCEL === '1';
  },
};
