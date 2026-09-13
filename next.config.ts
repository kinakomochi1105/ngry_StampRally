import type { NextConfig } from 'next';

const development = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy for every page and API response.
 *
 * Scripts stay on this origin. `'unsafe-inline'` remains for scripts because
 * Next streams its hydration data as inline scripts and the theme is applied
 * by one before first paint (app/layout.tsx); a nonce would make every page
 * dynamic, which a festival's worth of phones should not pay for. What the
 * policy still guarantees: no script, frame, form target or connection to
 * another origin, no plugins, and no framing of the console by another site.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // QR codes, barcodes and uploaded icons are data: URLs; the CSV download
  // and camera stills are blob: URLs.
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self'${development ? ' ws: wss:' : ''}`,
  // The QR decoder runs in a Web Worker bundled with the app.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A poster link carries its signature in the query (`/?stamp=`), which
  // should never be handed to another site as a referrer.
  { key: 'Referrer-Policy', value: 'same-origin' },
  // The camera is for the scanner on this origin only; nothing else is used.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Only in production: a LAN dev server over plain HTTP must not teach a
  // browser to insist on HTTPS for that address.
  ...(development
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
];

const nextConfig: NextConfig = {
  // Next regenerates AGENTS.md and CLAUDE.md on every build; this project keeps
  // its own notes in README.md.
  agentRules: false,
  // The libSQL client loads a native binding, which must stay outside the
  // bundle for the serverless function to build on Vercel.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // The encrypted nickname blocklist is read from disk at request time, so it
  // has to be traced into the serverless bundle explicitly.
  outputFileTracingIncludes: {
    '/api/register': ['./Config/forbidden'],
    '/api/recovery/setup': ['./Config/forbidden'],
    // The settings screen reports whether the blocklist can be read.
    '/api/admin/settings': ['./Config/forbidden'],
    // The administrator wiki reads its pages from disk at request time, so the
    // markdown is traced in the same way.
    '/api/admin/manual': ['./content/manual/**'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
