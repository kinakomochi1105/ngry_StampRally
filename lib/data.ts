import { database } from '@/db';
import { event, spots } from './event';
import { sign } from './server';
import {
  defaultSettings,
  readMapAreas,
  type FestivalSettings,
  type Spot,
  type VenueMap,
} from './types';

// The staff PIN lives under its own settings key, never inside the settings
// blob that `configuration()` hands to participants.
const staffPinKey = 'staff-pin:' + event.id;
export const hashStaffPin = (pin: string) =>
  sign('staffpin:' + event.id + ':' + pin);
export async function staffPinHash() {
  const row = await database()
    .prepare('SELECT value FROM settings WHERE event_id = ?')
    .bind(staffPinKey)
    .first<{ value: string }>();
  return row?.value ?? null;
}
export function saveStaffPinStatement(hash: string | null) {
  return hash === null
    ? database()
        .prepare('DELETE FROM settings WHERE event_id = ?')
        .bind(staffPinKey)
    : database()
        .prepare(
          'INSERT INTO settings (event_id,value) VALUES (?,?) ON CONFLICT(event_id) DO UPDATE SET value=excluded.value',
        )
        .bind(staffPinKey, hash);
}
/**
 * The word a visitor has to type before the participant screens will talk to
 * them. It lives under its own settings key, like the staff PIN, so it never
 * travels inside the settings blob that `configuration()` hands out. Only the
 * HMAC is stored: the plain word exists in the organiser's form and nowhere
 * else. Leaving it unset means the site is open, which is the default.
 */
const sitePasswordKey = 'site-password:' + event.id;
export const hashSitePassword = (password: string) =>
  sign('sitepassword:' + event.id + ':' + password);
export async function sitePasswordHash() {
  const row = await database()
    .prepare('SELECT value FROM settings WHERE event_id = ?')
    .bind(sitePasswordKey)
    .first<{ value: string }>();
  return row?.value ?? null;
}
export function saveSitePasswordStatement(hash: string | null) {
  return hash === null
    ? database()
        .prepare('DELETE FROM settings WHERE event_id = ?')
        .bind(sitePasswordKey)
    : database()
        .prepare(
          'INSERT INTO settings (event_id,value) VALUES (?,?) ON CONFLICT(event_id) DO UPDATE SET value=excluded.value',
        )
        .bind(sitePasswordKey, hash);
}
export async function configuration() {
  const row = await database()
    .prepare('SELECT value FROM settings WHERE event_id = ?')
    .bind(event.id)
    .first<{ value: string }>();
  return row ? (JSON.parse(row.value) as FestivalSettings) : defaultSettings;
}
export async function allSpots(activeOnly = true) {
  return (
    await database()
      .prepare(
        `SELECT id,name,location,description,icon,sort_order AS sortOrder,active FROM locations WHERE event_id = ? ${activeOnly ? 'AND active = 1' : ''} ORDER BY sort_order,id`,
      )
      .bind(event.id)
      .all<Spot>()
  ).results;
}
// Bounded, idempotent initial sample seed; explicit admin action only, never a migration.
export async function seedSpots() {
  await database().batch(
    spots.map((s, i) =>
      database()
        .prepare(
          'INSERT INTO locations (id,event_id,name,location,description,icon,sort_order,active) VALUES (?,?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING',
        )
        .bind(s.id, event.id, s.name, s.location, s.description, s.icon, i),
    ),
  );
}
/**
 * The venue maps, without the pictures themselves: those are far too big to
 * ride along with the rest of a screen's data, so they are fetched one at a
 * time from /api/map/<id> and cached by the browser.
 */
export async function allMaps(activeOnly = true): Promise<VenueMap[]> {
  const rows = (
    await database()
      .prepare(
        `SELECT id,name,width,height,areas,sort_order AS sortOrder,active,updated_at AS updatedAt FROM venue_maps WHERE event_id = ? ${activeOnly ? 'AND active = 1' : ''} ORDER BY sort_order,id`,
      )
      .bind(event.id)
      .all<Omit<VenueMap, 'areas'> & { areas: string }>()
  ).results;
  return rows.map((row) => {
    let areas: unknown = [];
    try {
      areas = JSON.parse(row.areas);
    } catch {}
    return {
      ...row,
      width: Number(row.width),
      height: Number(row.height),
      sortOrder: Number(row.sortOrder),
      active: Number(row.active),
      updatedAt: Number(row.updatedAt),
      areas: readMapAreas(areas),
    };
  });
}
/** One map's picture, as the data URL it was stored as. */
export async function mapImage(id: string, activeOnly = true) {
  const row = await database()
    .prepare(
      `SELECT image FROM venue_maps WHERE event_id = ? AND id = ? ${activeOnly ? 'AND active = 1' : ''}`,
    )
    .bind(event.id, id)
    .first<{ image: string }>();
  return row?.image ?? null;
}
export async function audit(action: string, target: string) {
  return database()
    .prepare('INSERT INTO audit_log (action,target,created_at) VALUES (?,?,?)')
    .bind(action, target, Math.floor(Date.now() / 1000))
    .run();
}
export async function bodyJson(
  request: Request,
  max = 8192,
): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Error('JSON形式で送信してください。');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('入力がありません。');
  let text = '',
    size = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error('入力データが大きすぎます。');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('入力形式が正しくありません。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('入力形式が正しくありません。');
  return data;
}
export function studentFields(
  data: Record<string, unknown>,
  config: FestivalSettings,
) {
  const grade = typeof data.grade === 'string' ? data.grade : '',
    className = typeof data.className === 'string' ? data.className : '',
    number = Number(data.number);
  if (
    !config.grades.includes(grade) ||
    !config.classes.includes(className) ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > config.maxNumber
  )
    throw new Error('学年・組・出席番号を確認してください。');
  return { grade, className, number };
}
