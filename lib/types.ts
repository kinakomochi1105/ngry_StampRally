export type Spot = {
  id: string;
  name: string;
  location: string;
  description: string;
  sortOrder: number;
  active: number;
};
export type Profile = {
  id: number;
  kind: 'student' | 'guest';
  grade: string | null;
  className: string | null;
  number: number | null;
  guestNumber: number | null;
  nickname: string | null;
  hasRecovery: boolean;
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
export const gradeLabel = (value: string) =>
  /^\d+$/.test(value) ? value + '年' : value;
export const classLabel = (value: string) =>
  value.endsWith('組') ? value : value + '組';
export const profileLabel = (p: Profile) =>
  p.kind === 'guest'
    ? `一般客 #${p.guestNumber}`
    : `${gradeLabel(p.grade ?? '')} ${classLabel(p.className ?? '')} ${p.number}番`;
