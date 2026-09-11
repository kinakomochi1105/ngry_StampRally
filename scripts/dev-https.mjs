// Starts the dev server over the self-signed certificate so that live QR
// scanning works from phones on the LAN. See scripts/setup-https.mjs.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const key = '.certs/dev-key.pem';
const cert = '.certs/dev-cert.pem';
if (!existsSync(key) || !existsSync(cert)) {
  console.error('No certificate found. Run: node scripts/setup-https.mjs');
  process.exit(1);
}

const child = spawn(
  'npx',
  [
    'next',
    'dev',
    '-H',
    '0.0.0.0',
    '--experimental-https',
    '--experimental-https-key',
    key,
    '--experimental-https-cert',
    cert,
  ],
  { stdio: 'inherit', shell: true },
);
child.on('exit', (code) => process.exit(code ?? 0));
