import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { sign } from './crypto';
import { event } from './event';
import { UserError } from './http';
import { defaultSettings, type FestivalSettings } from './types';

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : null;

/**
 * The stored settings, with every field checked and anything missing taken
 * from the defaults. A field added in a later release is therefore present on
 * a database saved by an earlier one, instead of arriving as `undefined`.
 */
export function readSettings(value: unknown): FestivalSettings {
  const stored =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const grades = stringList(stored.grades);
  const classes = stringList(stored.classes);
  const maxNumber = Number(stored.maxNumber);
  return {
    title:
      typeof stored.title === 'string' && stored.title.trim()
        ? stored.title
        : defaultSettings.title,
    grades: grades?.length ? grades : defaultSettings.grades,
    classes: classes?.length ? classes : defaultSettings.classes,
    maxNumber:
      Number.isInteger(maxNumber) && maxNumber >= 1
        ? maxNumber
        : defaultSettings.maxNumber,
    registrationOpen:
      typeof stored.registrationOpen === 'boolean'
        ? stored.registrationOpen
        : defaultSettings.registrationOpen,
    nicknameBlockedWords:
      stringList(stored.nicknameBlockedWords) ??
      defaultSettings.nicknameBlockedWords,
    nicknameAllowedWords:
      stringList(stored.nicknameAllowedWords) ??
      defaultSettings.nicknameAllowedWords,
  };
}

const nameList = (value: unknown, max: number) => {
  if (!Array.isArray(value) || !value.length || value.length > max)
    throw new UserError('学年・組を1つ以上入力してください。');
  const names = value.map((item: unknown) =>
    typeof item === 'string' ? item.trim() : '',
  );
  if (
    names.some((name) => !name || name.length > 12) ||
    new Set(names).size !== names.length
  )
    throw new UserError(
      '学年・組は重複しない12文字以内の名称を入力してください。',
    );
  return names;
};

const wordList = (value: unknown, label: string) => {
  const words = value ?? [];
  if (
    !Array.isArray(words) ||
    words.length > 100 ||
    words.some(
      (word: unknown) =>
        typeof word !== 'string' || !word.trim() || word.length > 40,
    )
  )
    throw new UserError(`${label}は40文字以内、100件までで入力してください。`);
  return [...new Set((words as string[]).map((word) => word.trim()))];
};

/** Checks the settings form an organiser sent. */
export function validateSettings(value: unknown): FestivalSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new UserError('設定がありません。');
  const input = value as Record<string, unknown>;
  const grades = nameList(input.grades, 20);
  const classes = nameList(input.classes, 50);
  const maxNumber = Number(input.maxNumber);
  const title = (typeof input.title === 'string' ? input.title : '').trim();
  if (
    !title ||
    title.length > 60 ||
    !Number.isInteger(maxNumber) ||
    maxNumber < 1 ||
    maxNumber > 999
  )
    throw new UserError('文化祭名と出席番号の上限を確認してください。');
  return {
    title,
    grades,
    classes,
    maxNumber,
    registrationOpen: input.registrationOpen === true,
    nicknameBlockedWords: wordList(input.nicknameBlockedWords, '追加禁止語'),
    nicknameAllowedWords: wordList(input.nicknameAllowedWords, '許可する語'),
  };
}

export async function configuration() {
  const row = await db()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.eventId, event.id))
    .get();
  if (!row) return defaultSettings;
  try {
    return readSettings(JSON.parse(row.value));
  } catch {
    return defaultSettings;
  }
}

const upsertStatement = (key: string, value: string) =>
  db()
    .insert(settings)
    .values({ eventId: key, value })
    .onConflictDoUpdate({ target: settings.eventId, set: { value } });

export const saveConfigurationStatement = (value: FestivalSettings) =>
  upsertStatement(event.id, JSON.stringify(value));

/**
 * Secrets an organiser sets from the console. Each lives under its own
 * settings key, never inside the blob `configuration()` hands to participants,
 * and only its HMAC is stored.
 *
 * - `staff-pin`: typed by staff on a participant's phone to confirm a reward.
 * - `site-password`: the word visitors type before the participant API answers.
 * - `desk-password`: signs a reward-desk device in with the desk role only.
 */
export type SecretName = 'staff-pin' | 'site-password' | 'desk-password';

// The purpose strings predate this module; changing one would invalidate the
// value already stored under it.
const purpose: Record<SecretName, string> = {
  'staff-pin': 'staffpin',
  'site-password': 'sitepassword',
  'desk-password': 'deskpassword',
};

const secretKey = (name: SecretName) => `${name}:${event.id}`;

export const hashSecret = (name: SecretName, value: string) =>
  sign(`${purpose[name]}:${event.id}:${value}`);

export async function secretHash(name: SecretName) {
  const row = await db()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.eventId, secretKey(name)))
    .get();
  return row?.value ?? null;
}

export const saveSecretStatement = (name: SecretName, hash: string | null) =>
  hash === null
    ? db()
        .delete(settings)
        .where(eq(settings.eventId, secretKey(name)))
    : upsertStatement(secretKey(name), hash);
