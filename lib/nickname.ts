// Shared validation; registration always repeats this check on the server.
export const nicknameKey = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase();
export const moderationKey = (value: string) =>
  nicknameKey(value)
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{N}]/gu, '');
const blockedWords = [
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
export function validateNickname(value: unknown, additional: string[] = []) {
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
  const key = moderationKey(nickname);
  if (
    [...blockedWords, ...additional].some((word) => {
      const normalized = moderationKey(word);
      return normalized.length > 0 && key.includes(normalized);
    })
  )
    throw new Error(
      'このニックネームは使用できません。別の名前を入力してください。',
    );
  return { nickname, key: nicknameKey(nickname) };
}
