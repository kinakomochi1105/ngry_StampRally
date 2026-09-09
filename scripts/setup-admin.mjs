import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
let text = readFileSync('.env', 'utf8');
if (!text.includes('ADMIN_PASSWORD=')) {
  text += '\nADMIN_PASSWORD=' + randomBytes(24).toString('base64url') + '\n';
  writeFileSync('.env', text);
}
const password = text
  .split('\n')
  .find((s) => s.startsWith('ADMIN_PASSWORD='))
  .slice(15);
mkdirSync('outputs', { recursive: true });
writeFileSync(
  'outputs/admin-access.txt',
  '文化祭 管理者ログイン\n\nURL: /admin\nパスワード: ' +
    password +
    '\n\n管理者だけで保管してください。参加者に共有しないでください。\n',
);
console.log('Admin password prepared in outputs/admin-access.txt');
