import { randomHex, safeEqual, sign } from './crypto';
import { env } from './env';
import {
  isSecureRequest,
  readCookie,
  requireSameOrigin,
  UserError,
} from './http';
import { secretHash } from './settings';

/**
 * Console sessions.
 *
 * - `admin` signs in with ADMIN_PASSWORD and can do everything.
 * - `desk` signs in with the reward-desk password an admin sets in the
 *   console, and can only read reward codes (and the manual). Handing a desk
 *   device to a volunteer no longer hands them the power to delete every
 *   participant.
 *
 * Whoever signs in may name the device ("受付1"). The name rides in the signed
 * cookie and is written into the operations history with every change.
 *
 * The signature covers the secret the role signed in with — the admin
 * password, or the stored hash of the desk password — so changing either one
 * ends every session that was opened with the old value.
 */
export type AdminRole = 'admin' | 'desk';
export type AdminSession = { role: AdminRole; label: string; actor: string };

const cookieName = 'rally_admin';
const sessionSeconds = 8 * 3600;
export const minimumAdminPassword = 16;

/** Keeps a device name short and printable; '' when nothing usable is left. */
export function deviceLabel(value: unknown) {
  if (typeof value !== 'string') return '';
  return Array.from(
    value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\p{M} ._#()・-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, 20)
    .join('')
    .trim();
}

const encodeLabel = (label: string) =>
  Buffer.from(label, 'utf8').toString('base64url');
const decodeLabel = (value: string) =>
  deviceLabel(Buffer.from(value, 'base64url').toString('utf8'));

export const actorName = (role: AdminRole, label: string) =>
  label ? `${role}:${label}` : role;

async function roleSecret(role: AdminRole) {
  if (role === 'admin')
    return env.ADMIN_PASSWORD.length >= minimumAdminPassword
      ? env.ADMIN_PASSWORD
      : null;
  return secretHash('desk-password');
}

const signature = (
  role: AdminRole,
  expires: string,
  nonce: string,
  label: string,
  secret: string,
) => sign(`admin-session:${role}:${expires}:${nonce}:${label}:${secret}`);

export async function adminSession(
  request: Request,
): Promise<AdminSession | null> {
  const value = readCookie(request, cookieName);
  if (!value) return null;
  const [expires, nonce, role, label, mac] = value.split('.');
  if (
    !/^\d{10}$/.test(expires ?? '') ||
    Number(expires) <= Date.now() / 1000 ||
    !/^[a-f0-9]{32}$/.test(nonce ?? '') ||
    (role !== 'admin' && role !== 'desk') ||
    !/^[A-Za-z0-9_-]*$/.test(label ?? '')
  )
    return null;
  const secret = await roleSecret(role);
  if (
    !secret ||
    !safeEqual(mac ?? '', await signature(role, expires, nonce, label, secret))
  )
    return null;
  const name = decodeLabel(label);
  return { role, label: name, actor: actorName(role, name) };
}

export async function adminCookie(
  request: Request,
  role: AdminRole,
  label: string,
) {
  const secret = await roleSecret(role);
  if (!secret) throw new Error('No secret for role ' + role);
  const expires = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  const nonce = randomHex(16);
  const encoded = encodeLabel(deviceLabel(label));
  const mac = await signature(role, expires, nonce, encoded, secret);
  return `${cookieName}=${expires}.${nonce}.${role}.${encoded}.${mac}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${sessionSeconds}${isSecureRequest(request) ? '; Secure' : ''}`;
}

export const clearAdminCookie = (request: Request) =>
  `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${isSecureRequest(request) ? '; Secure' : ''}`;

/**
 * The session a console route runs under. Throws 401 without one, 403 for a
 * role the route does not allow, and 403 for a change sent from another site.
 */
export async function requireAdmin(
  request: Request,
  {
    roles = ['admin'],
    mutation = false,
  }: { roles?: AdminRole[]; mutation?: boolean } = {},
) {
  const session = await adminSession(request);
  if (!session) throw new UserError('管理者ログインが必要です。', 401);
  if (mutation) requireSameOrigin(request);
  if (!roles.includes(session.role))
    throw new UserError('この操作を行う権限がありません。', 403);
  return session;
}
