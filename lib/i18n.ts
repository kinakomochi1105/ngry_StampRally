import en from './en.json';

export type Locale = 'ja' | 'en';

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'ja' || base === 'en') return base;
  }
  return 'ja';
}

/**
 * Sentences that carry a number cannot be listed in en.json, so each one is
 * matched here instead. Anything not covered falls through unchanged, which
 * is what keeps organiser-authored names and rooms in their original wording.
 */
const counted: [RegExp, (n: string) => string][] = [
  [
    /^あと(\d+)か所。次のスポットへ出かけよう。$/,
    (n) => `${n} locations to go. Find your next stamp!`,
  ],
  [
    /^あと(\d+)個。設置場所でQRコードを読み取ろう。$/,
    (n) => `${n} stamps to go. Scan a QR code at each location.`,
  ],
];

/** UI strings only: never translate identifiers, nicknames or administrator-authored data. */
export function translate(text: string, locale: Locale): string {
  if (locale === 'ja') return text;
  const direct = (en as Record<string, string>)[text];
  if (direct !== undefined) return direct;
  for (const [pattern, format] of counted) {
    const match = pattern.exec(text);
    if (match) return format(match[1]);
  }
  return text;
}
