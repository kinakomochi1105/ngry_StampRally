/**
 * Crowd levels, shared by the API and the screens so a reading is described
 * the same way wherever it appears.
 *
 * Two signals feed the same three levels:
 *   - scans, counted automatically from valid QR reads (no one has to do
 *     anything, but it only sees people who reached the code);
 *   - reports, sent by participants from the locations screen (it sees the
 *     queue in front of the code, which is what actually slows a visit down).
 *
 * Reports win when there are any, because a person standing in the queue knows
 * more than a scan counter does.
 */

export type CrowdLevel = 'quiet' | 'moving' | 'busy';

export const crowdLevels = [1, 2, 3] as const;
export type CrowdReading = (typeof crowdLevels)[number];

/** The window a report counts for, in seconds. */
export const reportWindow = 20 * 60;
/** One report per participant per location inside this window. */
export const reportCooldown = 5 * 60;

export const scanLevel = (count: number): CrowdLevel =>
  count >= 8 ? 'busy' : count >= 3 ? 'moving' : 'quiet';

/** Thirds of the 1–3 scale, so each level covers an equal share of it. */
export const averageLevel = (average: number): CrowdLevel =>
  average >= 7 / 3 ? 'busy' : average >= 5 / 3 ? 'moving' : 'quiet';

export const levelLabel: Record<CrowdLevel, string> = {
  quiet: '今は空いています',
  moving: '少し動きがあります',
  busy: '混雑しています',
};

/** The wording used when a participant chooses what to send. */
export const reportChoices: {
  value: CrowdReading;
  level: CrowdLevel;
  label: string;
}[] = [
  { value: 1, level: 'quiet', label: 'すぐ押せる' },
  { value: 2, level: 'moving', label: '少し待つ' },
  { value: 3, level: 'busy', label: '行列ができている' },
];

export const validReading = (value: unknown): value is CrowdReading =>
  value === 1 || value === 2 || value === 3;
