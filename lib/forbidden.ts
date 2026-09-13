import { env } from './env';
import { UserError } from './http';
import { validateNickname } from './nickname';
import type { FestivalSettings } from './types';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * `Config/forbidden` is an AES-256-CBC/PKCS7 encrypted, Base64 encoded JSON
 * file (`{"words": [...]}`) produced by EncryptorTool. The key and IV are the
 * ones in the tool's config.toml, supplied here through NICKNAME_BLOCKLIST_KEY
 * and NICKNAME_BLOCKLIST_IV so they never sit in the repository beside the file.
 */
function decodeBase64(value: string) {
  const encoded = value.replace(/^\uFEFF/, '').replace(/\s+/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function wordsFromJson(text: string): string[] | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || !('words' in value)) return null;
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

function blocklistCipher() {
  const key = textEncoder.encode(env.NICKNAME_BLOCKLIST_KEY);
  const iv = textEncoder.encode(env.NICKNAME_BLOCKLIST_IV);
  if (key.byteLength !== 32 || iv.byteLength !== 16)
    throw new Error(
      'NICKNAME_BLOCKLIST_KEY (32 bytes) and NICKNAME_BLOCKLIST_IV (16 bytes) are not configured',
    );
  return { key, iv };
}

export async function decryptBlocklist(contents: string) {
  const cipher = blocklistCipher();
  const key = await crypto.subtle.importKey(
    'raw',
    cipher.key,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: cipher.iv },
      key,
      decodeBase64(contents),
    );
  } catch {
    throw new Error(
      'Nickname blocklist could not be decrypted: check the key and IV',
    );
  }
  const words = wordsFromJson(textDecoder.decode(plain));
  if (words === null) throw new Error('Nickname blocklist is not valid JSON');
  return words;
}

// `Config/forbidden` is not imported by any module, so Next only ships it to
// the serverless function because `outputFileTracingIncludes` in next.config.ts
// names it.
async function readBlocklistFile() {
  const [fs, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);
  const file =
    env.NICKNAME_BLOCKLIST_PATH ||
    path.join(process.cwd(), 'Config', 'forbidden');
  try {
    return await fs.readFile(file, { encoding: 'utf8' });
  } catch {
    throw new Error('Nickname blocklist file is missing: ' + file);
  }
}

let wordsPromise: Promise<readonly string[]> | undefined;

/** Read and decrypted once per instance, then kept in memory. */
export async function loadForbiddenWords(): Promise<readonly string[]> {
  wordsPromise ??= readBlocklistFile()
    .then(decryptBlocklist)
    .then((words) => Object.freeze(words))
    .catch((error: unknown) => {
      // A failed read must not be cached, or one cold-start hiccup would
      // disable the check for the life of the instance.
      wordsPromise = undefined;
      throw error;
    });
  return wordsPromise;
}

/** Why the blocklist cannot be used, for the console; null when it can. */
export async function blocklistProblem() {
  try {
    await loadForbiddenWords();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The server's nickname check: every list, with a rule break shown as it is. */
export async function checkNickname(value: unknown, config: FestivalSettings) {
  const blocked = [
    ...(await loadForbiddenWords()),
    ...config.nicknameBlockedWords,
  ];
  try {
    return validateNickname(value, blocked, config.nicknameAllowedWords);
  } catch (error) {
    throw new UserError(
      error instanceof Error
        ? error.message
        : 'ニックネームを確認してください。',
    );
  }
}
