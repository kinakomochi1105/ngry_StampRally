// Generates a self-signed certificate so the LAN dev server can be served over
// HTTPS. Live QR scanning (getUserMedia) refuses to run outside a secure
// context, and plain http://192.168.x.x is not one. A certificate is the only
// way to get continuous scanning on a network with no internet access.
//
// Participants still see a browser warning once per device, because nothing
// vouches for this certificate. Prefer the Vercel deployment, which has a real
// certificate, whenever the venue has internet.
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const dir = '.certs';
const key = join(dir, 'dev-key.pem');
const cert = join(dir, 'dev-cert.pem');

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address);
const unique = [...new Set(addresses)];

// Browsers match the SAN list and ignore the common name, so every address the
// phone might use has to be listed here.
const san = [
  'DNS:localhost',
  'IP:127.0.0.1',
  ...unique.map((a) => `IP:${a}`),
].join(',');

mkdirSync(dir, { recursive: true });
if (existsSync(cert) && !process.argv.includes('--force')) {
  console.log(`${cert} already exists. Pass --force to regenerate.`);
  process.exit(0);
}

execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    key,
    '-out',
    cert,
    '-days',
    '180',
    '-subj',
    '/CN=festival-rally-dev',
    '-addext',
    `subjectAltName=${san}`,
    '-addext',
    'basicConstraints=critical,CA:FALSE',
    '-addext',
    'keyUsage=critical,digitalSignature,keyEncipherment',
    '-addext',
    'extendedKeyUsage=serverAuth',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

console.log('Created a self-signed certificate for:');
console.log('  https://localhost:3000');
for (const a of unique) console.log(`  https://${a}:3000`);
console.log('\nStart the server with: npm run dev:https');
console.log(
  'Each device shows a certificate warning once; continue past it to allow the camera.',
);
