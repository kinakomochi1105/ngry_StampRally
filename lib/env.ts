// Cloudflare exposed secrets as Worker bindings through `cloudflare:workers`.
// On Node they are plain environment variables. Reading them through getters
// keeps the call sites unchanged and defers the lookup to request time, so a
// missing value surfaces as a handled 503 rather than a module-load crash.
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
};
