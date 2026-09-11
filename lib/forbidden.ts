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

let wordsPromise: Promise<readonly string[]> | undefined;

// `Config/forbidden` is not imported by any module, so Next only ships it to
// the serverless function because `outputFileTracingIncludes` in next.config.ts
// names it. Read once per instance and keep the decrypted list in memory.
async function readFile() {
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
  throw new Error('Forbidden nickname list is missing');
}

export async function loadForbiddenWords(): Promise<readonly string[]> {
  wordsPromise ??= readFile()
    .then(decryptFileContents)
    .then((words) => {
      if (words === null) throw new Error('Forbidden nickname list is invalid');
      return Object.freeze(words);
    })
    .catch((error: unknown) => {
      // A failed read must not be cached, or one cold-start hiccup would
      // disable the check for the life of the instance.
      wordsPromise = undefined;
      throw error;
    });
  return wordsPromise;
}
