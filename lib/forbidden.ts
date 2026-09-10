/// <reference types="vite/client" />

import forbiddenText from '@/Config/forbidden?raw';

const forbiddenKey = 'bunka31ngry2025tohirotogurugurus';
const forbiddenIv = 'bunka31JumblePix';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// `Config/forbidden` is an AES-CBC/PKCS7 encrypted Base64 file produced by
// EncryptorTool. The key and IV match the tool's config.toml.
function decodeBase64(value: string) {
  const encoded = value.replace(/^\uFEFF/, '').replace(/\s+/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function wordsFromJson(text: string): string[] | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || !('words' in value))
      return null;
    const words = (value as { words?: unknown }).words;
    if (!Array.isArray(words)) return null;
    return Array.from(
      new Set(
        words
          .filter((word): word is string => typeof word === 'string')
          .map((word) => word.normalize('NFKC').trim())
          .filter(Boolean),
      ),
    );
  } catch {
    return null;
  }
}

async function decryptFileContents(value: string) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(forbiddenKey),
      { name: 'AES-CBC' },
      false,
      ['decrypt'],
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: textEncoder.encode(forbiddenIv) },
      key,
      decodeBase64(value),
    );
    return wordsFromJson(textDecoder.decode(plain));
  } catch {
    return null;
  }
}

async function readRuntimeFile() {
  if (typeof process === 'undefined' || process.release?.name !== 'node')
    return null;
  try {
    const [fs, path] = await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
    ]);
    const candidates = [
      path.join(process.cwd(), 'Config', 'forbidden'),
      path.join(process.cwd(), 'Server', 'Config', 'forbidden'),
    ];
    for (const filePath of candidates) {
      try {
        return await fs.readFile(filePath, { encoding: 'utf8' });
      } catch {
        // Try the next supported server-root layout.
      }
    }
  } catch {
    // A Worker has no Node filesystem; use the embedded file below.
  }
  return null;
}

let embeddedWordsPromise: Promise<readonly string[]> | undefined;

async function embeddedWords() {
  // Workers do not expose a filesystem, so the encrypted file is embedded by
  // Vite and decrypted when the module is first used.
  embeddedWordsPromise ??= decryptFileContents(forbiddenText).then((words) => {
    if (words === null) throw new Error('Forbidden nickname list is invalid');
    return Object.freeze(words);
  });
  return embeddedWordsPromise;
}

export async function loadForbiddenWords(): Promise<readonly string[]> {
  const runtimeText = await readRuntimeFile();
  if (runtimeText !== null) {
    const words = await decryptFileContents(runtimeText);
    if (words !== null) return Object.freeze(words);
  }
  return embeddedWords();
}
