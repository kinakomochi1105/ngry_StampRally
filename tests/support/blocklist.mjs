// Writes an encrypted nickname blocklist in the same format as
// Config/forbidden (AES-256-CBC, Base64, JSON `{"words": [...]}`), under a
// freshly generated key, and prints the variables that let the server read it.
// CI uses it so the real key never has to be a repository secret.
//
//   node tests/support/blocklist.mjs <output-file> [word ...]
import { createCipheriv, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function encryptBlocklist(words) {
  // Printable characters, because the server encodes the variables as UTF-8.
  const key = randomBytes(24).toString('base64').slice(0, 32);
  const iv = randomBytes(12).toString('base64').slice(0, 16);
  const cipher = createCipheriv(
    'aes-256-cbc',
    Buffer.from(key),
    Buffer.from(iv),
  );
  const contents = Buffer.concat([
    cipher.update(JSON.stringify({ words }), 'utf8'),
    cipher.final(),
  ]).toString('base64');
  return { key, iv, contents };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [output, ...words] = process.argv.slice(2);
  if (!output)
    throw new Error(
      'Usage: node tests/support/blocklist.mjs <file> [word ...]',
    );
  const blocklist = encryptBlocklist(words.length ? words : ['うんこ']);
  writeFileSync(output, blocklist.contents);
  console.log(`NICKNAME_BLOCKLIST_PATH=${output}`);
  console.log(`NICKNAME_BLOCKLIST_KEY=${blocklist.key}`);
  console.log(`NICKNAME_BLOCKLIST_IV=${blocklist.iv}`);
}
