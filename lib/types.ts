export type Spot = {
  id: string;
  name: string;
  location: string;
  description: string;
  /** A template key, an uploaded PNG/JPEG data URL, or '' for the default. */
  icon: string;
  sortOrder: number;
  active: number;
};
/** Template icons an organiser can choose; see components/spot-icon.tsx. */
export const spotIconKeys = [
  'flag',
  'palette',
  'flask',
  'coffee',
  'music',
  'theater',
  'book',
  'camera',
  'game',
  'food',
  'trophy',
  'sparkles',
];
/** Used for locations with no icon of their own, in list order. */
export const defaultSpotIconKeys = spotIconKeys.slice(0, 6);
/** Uploaded icons are stored inline, so they stay small: 128px, up to 96KB. */
export const maxSpotIconLength = 96000;
export const isCustomSpotIcon = (icon: string) =>
  icon.startsWith('data:image/');
export const validSpotIcon = (icon: string) =>
  icon === '' ||
  spotIconKeys.includes(icon) ||
  (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(icon) &&
    icon.length <= maxSpotIconLength);
/**
 * The venue map: a picture the organiser uploads, with rectangles drawn over
 * it. Every rectangle is stored as fractions of the picture rather than
 * pixels, so it lands in the same place whatever size the map is shown at.
 */
export type MapArea = {
  id: string;
  /** The location this area opens, or '' for a label that only marks a place. */
  spotId: string;
  /** Shown when the area has no location of its own (受付, トイレ, ...). */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** '#rrggbb' for this button's own colour, or '' to follow the theme. */
  bg: string;
  /** '#rrggbb' for the text and number on it, or '' to follow the theme. */
  fg: string;
};
/** Colours are organiser input, so only a plain hex value is ever stored. */
export const mapColour = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : '';
export type VenueMap = {
  id: string;
  name: string;
  /** The picture's own pixel size, which fixes the aspect ratio. */
  width: number;
  height: number;
  areas: MapArea[];
  sortOrder: number;
  active: number;
  /** Changes whenever the map is saved; the picture's URL carries it. */
  updatedAt: number;
};
/** The picture travels as a data URL, so the cap is on the encoded length. */
export const maxMapImageLength = 1400000;
export const maxMapAreas = 120;
/** The longest edge the browser scales an uploaded map down to before sending. */
export const mapImageSize = 2000;
export const validMapImage = (image: string) =>
  /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image) &&
  image.length <= maxMapImageLength;
const fraction = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
/** Areas arrive from the organiser's browser, so every field is checked here. */
export function readMapAreas(value: unknown): MapArea[] {
  const list = Array.isArray(value) ? value : [];
  const areas: MapArea[] = [];
  for (const item of list.slice(0, maxMapAreas)) {
    if (!item || typeof item !== 'object') continue;
    const area = item as Record<string, unknown>;
    const id = typeof area.id === 'string' ? area.id : '';
    const spotId = typeof area.spotId === 'string' ? area.spotId : '';
    const label = typeof area.label === 'string' ? area.label.trim() : '';
    if (!/^[a-z0-9-]{1,64}$/.test(id)) continue;
    if (spotId && !/^[a-z0-9-]{1,64}$/.test(spotId)) continue;
    if (label.length > 40) continue;
    if (
      !fraction(area.x) ||
      !fraction(area.y) ||
      !fraction(area.w) ||
      !fraction(area.h) ||
      area.w <= 0 ||
      area.h <= 0 ||
      area.x + area.w > 1.0001 ||
      area.y + area.h > 1.0001
    )
      continue;
    areas.push({
      id,
      spotId,
      label,
      x: area.x,
      y: area.y,
      w: area.w,
      h: area.h,
      bg: mapColour(area.bg),
      fg: mapColour(area.fg),
    });
  }
  return areas;
}
export type Profile = {
  id: number;
  kind: 'student' | 'guest';
  grade: string | null;
  className: string | null;
  number: number | null;
  guestNumber: number | null;
  nickname: string | null;
  hasRecovery: boolean;
  completedAt: number | null;
  redeemedAt: number | null;
};
export type FestivalSettings = {
  title: string;
  grades: string[];
  classes: string[];
  maxNumber: number;
  registrationOpen: boolean;
  nicknameBlockedWords?: string[];
};
export const defaultSettings: FestivalSettings = {
  title: '文化祭スタンプラリー',
  grades: ['1', '2', '3'],
  classes: ['A', 'B', 'C', 'D', 'E'],
  maxNumber: 50,
  registrationOpen: true,
};
export const gradeLabel = (value: string, locale = 'ja') =>
  /^\d+$/.test(value)
    ? locale === 'en'
      ? 'Grade ' + value
      : value + '年'
    : value;
export const classLabel = (value: string, locale = 'ja') =>
  locale === 'en'
    ? 'Class ' + value
    : value.endsWith('組')
      ? value
      : value + '組';
export const profileLabel = (p: Profile, locale = 'ja') =>
  p.kind === 'guest'
    ? (locale === 'en' ? 'Guest #' : '一般客 #') + p.guestNumber
    : gradeLabel(p.grade ?? '', locale) +
      ' ' +
      classLabel(p.className ?? '', locale) +
      ' ' +
      p.number +
      (locale === 'en' ? '' : '番');
