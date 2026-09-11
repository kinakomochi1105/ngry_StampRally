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
