import { env } from './env';

/**
 * A failure the person on the other end can act on: a wrong input, a missing
 * sign-in, a limit reached. Its message is shown as it is. Anything else that
 * escapes a route is a fault, which is logged and answered with the route's
 * own neutral wording instead.
 */
export class UserError extends Error {
  readonly status: number;
  /** A machine-readable reason the screen reacts to, e.g. `gate`. */
  readonly code?: string;
  readonly headers: Record<string, string>;
  constructor(
    message: string,
    status = 400,
    options: { code?: string; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'UserError';
    this.status = status;
    this.code = options.code;
    this.headers = options.headers ?? {};
  }
}

export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

/**
 * Puts a fault on the server console. Drizzle wraps a database error in one
 * whose message carries the bound values (nicknames, hashes), so only the SQL
 * and the underlying cause are written out.
 */
export function logFailure(scope: string, error: unknown) {
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause : null;
  const query =
    cause && error instanceof Error
      ? error.message.split('\nparams:')[0] + '\n'
      : '';
  const shown = cause ?? error;
  const detail =
    shown instanceof Error ? (shown.stack ?? shown.message) : String(shown);
  console.error(
    `\x1b[31m✗ API ${scope}\x1b[0m ${new Date().toISOString()}\n${query}${detail}`,
  );
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * Wraps a route handler so every route fails the same way: a UserError is
 * answered with its own message and status, anything else is logged and
 * answered 503 with `fallback`.
 */
export function route<C = unknown>(
  scope: string,
  fallback: string,
  handler: Handler<C>,
) {
  return async (request: Request, context: C) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof UserError)
        return json(
          error.code
            ? { error: error.message, code: error.code }
            : { error: error.message },
          error.status,
          error.headers,
        );
      logFailure(scope, error);
      return json({ error: fallback }, 503);
    }
  };
}

/** True when a database error is a UNIQUE constraint, wrapped or not. */
export function isUniqueViolation(error: unknown) {
  for (let e: unknown = error; e instanceof Error; e = e.cause)
    if (e.message.includes('UNIQUE constraint failed')) return true;
  return false;
}

export function readCookie(request: Request, name: string) {
  const prefix = name + '=';
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export async function bodyJson(
  request: Request,
  max = 8192,
): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new UserError('JSON形式で送信してください。');
  const reader = request.body?.getReader();
  if (!reader) throw new UserError('入力がありません。');
  let text = '';
  let size = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new UserError('入力データが大きすぎます。', 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new UserError('入力形式が正しくありません。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new UserError('入力形式が正しくありません。');
  return data as Record<string, unknown>;
}

const forwarded = (request: Request, name: string) =>
  request.headers.get(name)?.split(',')[0]?.trim() || '';

/**
 * Bucket key for the rate limits. Vercel's edge replaces the forwarded
 * headers with what it saw, so on Vercel they name the real client. Anywhere
 * else (a LAN dev server) the caller could write them itself, so every request
 * shares one bucket rather than trusting them.
 */
export function clientAddress(request: Request) {
  if (!env.VERCEL) return 'local';
  return (
    request.headers.get('x-real-ip')?.trim() ||
    forwarded(request, 'x-forwarded-for') ||
    'unknown'
  );
}

/*
 * The scheme and host the browser used. Next fills in the forwarded headers
 * from the connection itself when no proxy has, so they correct what the
 * request URL gets wrong (a server bound to 0.0.0.0, Vercel's internal host).
 * Believing them is safe here where it is not for an address: a browser cannot
 * set them on a cross-site request, so a forged value only changes the answer
 * to its own sender.
 */
export function isSecureRequest(request: Request) {
  if (forwarded(request, 'x-forwarded-proto') === 'https') return true;
  return new URL(request.url).protocol === 'https:';
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = forwarded(request, 'x-forwarded-host') || url.host;
  return `${isSecureRequest(request) ? 'https' : 'http'}://${host}`;
}

/**
 * Absolute origin baked into printed QR links. Posters are often produced on a
 * laptop at localhost while participants open the public address, so an
 * explicit RALLY_SITE_URL always wins over the origin of the request.
 */
export function siteOrigin(request: Request) {
  const configured = env.RALLY_SITE_URL.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/?#\s]+$/i.test(configured)
    ? configured
    : requestOrigin(request);
}

export function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return (
    origin === requestOrigin(request) || origin === new URL(request.url).origin
  );
}

/** Refuses a state change sent from another site (CSRF). */
export function requireSameOrigin(request: Request) {
  if (!validOrigin(request))
    throw new UserError('ページを開き直してください。', 403);
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);
