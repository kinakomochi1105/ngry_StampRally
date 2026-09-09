import en from './en.json';
export type Locale = 'ja' | 'en';
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'ja' || base === 'en') return base;
  }
  return 'ja';
}
/** UI strings only: never translate identifiers, nicknames or administrator-authored data. */
export function translate(text: string, locale: Locale): string {
  if (locale === 'ja') return text;
  const direct = (en as Record<string, string>)[text];
  if (direct !== undefined) return direct;
  const remaining = /^あと(\d+)か所。次のスポットへ出かけよう。$/.exec(text);
  if (remaining)
    return `${remaining[1]} locations to go. Find your next stamp!`;
  return text;
}
