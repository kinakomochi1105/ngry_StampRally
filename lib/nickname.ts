// Shared validation; registration always repeats this check on the server.
export const nicknameKey = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase();
export const moderationKey = (value: string) =>
  nicknameKey(value)
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{N}]/gu, '');
// A small local fallback keeps the client responsive while the server remains
// authoritative and adds the encrypted Config/forbidden list.
const fallbackBlockedWords = [
  '死ね',
  '殺す',
  '殺害',
  '自殺しろ',
  'ころす',
  'しね',
  'れいぷ',
  'せっくす',
  'ちんこ',
  'まんこ',
  'おっぱい',
  'fuck',
  'shit',
  'sex',
  'nigger',
  'nazi',
  '管理者',
  '管理人',
  '運営',
  '公式',
  'admin',
  'administrator',
  'moderator',
];
/**
 * Ordinary words and names that contain a blocked word. Matching is by
 * substring, so without these "Yamashita" reads as "shit" and "シネマ" as
 * "しね". Romanised Japanese is listed with the vowel before "shi" so a name is
 * let through while the English word on its own is not.
 */
const builtInAllowedWords = [
  ...['a', 'i', 'u', 'e', 'o'].flatMap((vowel) =>
    ['shita', 'shite', 'shito', 'shitsu'].map((tail) => vowel + tail),
  ),
  'badminton',
  'essex',
  'sussex',
  'middlesex',
  'シネマ',
  'ころすけ',
];
const keys = (words: readonly string[]) =>
  words.map(moderationKey).filter((word) => word.length > 0);
/**
 * The part of a nickname that is checked against the blocked words: its
 * moderation key with every allowed word cut out. The cut leaves a separator
 * behind, so a blocked word cannot be formed across the gap.
 */
export function screenedKey(nickname: string, allowed: readonly string[] = []) {
  let key = moderationKey(nickname);
  for (const word of keys([...builtInAllowedWords, ...allowed]).sort(
    (a, b) => b.length - a.length,
  ))
    key = key.replaceAll(word, '|');
  return key;
}
export function validateNickname(
  value: unknown,
  blocked: readonly string[] = [],
  allowed: readonly string[] = [],
) {
  if (typeof value !== 'string')
    throw new Error('ニックネームを入力してください。');
  const nickname = value.normalize('NFKC').trim();
  if (
    Array.from(nickname).length < 2 ||
    Array.from(nickname).length > 20 ||
    !/[\p{L}\p{N}]/u.test(nickname) ||
    !/^[-_\p{L}\p{M}\p{N}]+$/u.test(nickname)
  )
    throw new Error(
      'ニックネームは2〜20文字の文字・数字・「-」「_」で入力してください。',
    );
  const key = screenedKey(nickname, allowed);
  if (
    keys([...fallbackBlockedWords, ...blocked]).some((word) =>
      key.includes(word),
    )
  )
    throw new Error(
      'このニックネームは使用できません。別の名前を入力してください。',
    );
  return { nickname, key: nicknameKey(nickname) };
}
