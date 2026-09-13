// No imports: scripts/generate-qr.mjs and tests/api.mjs load this file directly
// with Node's type stripping, which does not resolve extensionless imports.

/** Used until an organiser names the festival; existing data was written under it. */
export const defaultEventId = 'festival-2026';

/**
 * The festival every row, cookie and QR signature belongs to. Set
 * RALLY_EVENT_ID to start a new year's festival on the same database: the
 * previous one's data stays, untouched, under its own id. Changing it during a
 * festival invalidates every printed QR code and every participant's cookie.
 */
export const event = {
  get id() {
    const configured = (process.env.RALLY_EVENT_ID ?? '').trim();
    if (!configured) return defaultEventId;
    if (!/^[a-z0-9-]{1,64}$/.test(configured))
      throw new Error(
        'RALLY_EVENT_ID must be 1-64 lowercase letters, digits or hyphens',
      );
    return configured;
  },
};

/** The six sample locations an organiser can create from the console. */
export const sampleSpots = [
  {
    id: 'entrance',
    name: 'ようこそ、文化祭',
    location: '1F · エントランス',
    description: '受付横の案内板',
    icon: 'flag',
  },
  {
    id: 'art',
    name: 'アートギャラリー',
    location: '2F · 美術室',
    description: '作品展示の入口',
    icon: 'palette',
  },
  {
    id: 'science',
    name: 'ふしぎの実験室',
    location: '3F · 理科室',
    description: '実験コーナーの入口',
    icon: 'flask',
  },
  {
    id: 'cafe',
    name: 'ひとやすみカフェ',
    location: '1F · 多目的室',
    description: 'カフェの受付',
    icon: 'coffee',
  },
  {
    id: 'music',
    name: '音楽のひろば',
    location: '2F · 音楽室',
    description: '教室前の案内板',
    icon: 'music',
  },
  {
    id: 'stage',
    name: 'メインステージ',
    location: '別棟 · 体育館',
    description: '体育館の入口',
    icon: 'theater',
  },
];
