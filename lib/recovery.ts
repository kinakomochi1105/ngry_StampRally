import { database } from '@/db';
import { sign, clientAddress } from './server';
export async function makeRecovery() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase();
  return {
    code: raw.match(/.{4}/g)!.join('-'),
    hash: await sign('recovery:' + raw),
  };
}
export function normalizeCode(value: unknown) {
  if (typeof value !== 'string') return '';
  const raw = value.normalize('NFKC').replace(/[-\s]/g, '').toUpperCase();
  return /^[A-F0-9]{32}$/.test(raw) ? raw : '';
}
export async function recoveryLimit(request: Request, codeHash: string) {
  const now = Math.floor(Date.now() / 1000),
    expiry = now + 900;
  const ipKey = await sign('recovery-ip:' + clientAddress(request));
  const targetKey = await sign('recovery-target:' + codeHash);
  const results = await database().batch<{ attempts: number }>(
    [ipKey, targetKey].map((key) =>
      database()
        .prepare(
          'INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts',
        )
        .bind(key, expiry, now, now, expiry),
    ),
  );
  return {
    limited:
      Number(results[0].results[0]?.attempts) > 100 ||
      Number(results[1].results[0]?.attempts) > 10,
    ipKey,
    targetKey,
  };
}
