import { randomHex, sign } from './crypto';

/** The HMAC of a normalised code: all the database keeps of it. */
export const recoveryHash = (normalizedCode: string) =>
  sign('recovery:' + normalizedCode);

/** A new recovery code, shown once, and its hash. */
export async function makeRecovery() {
  const raw = randomHex(16).toUpperCase();
  return {
    code: raw.match(/.{4}/g)!.join('-'),
    hash: await recoveryHash(raw),
  };
}

/** Accepts the code however it was typed: case, width, spaces and hyphens. */
export function normalizeCode(value: unknown) {
  if (typeof value !== 'string') return '';
  const raw = value.normalize('NFKC').replace(/[-\s]/g, '').toUpperCase();
  return /^[A-F0-9]{32}$/.test(raw) ? raw : '';
}
