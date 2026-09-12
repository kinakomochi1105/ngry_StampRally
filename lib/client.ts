/**
 * The one way the browser talks to this app's API.
 *
 * Every screen used to repeat the same four steps — build the request, parse
 * the body, decide whether it failed, invent a message — and each copy handled
 * the edge cases slightly differently. The worst of those: a crash page or a
 * proxy error is HTML, so `response.json()` throws a parser error and the
 * participant was shown `Unexpected token '<'`. Here a body that is not JSON
 * is simply an empty one, and the caller's own wording is used instead.
 */

export type ApiError = Error & {
  status: number;
  /** A machine-readable reason, when the API sends one (e.g. `gate`). */
  code?: string;
};

export type ApiOptions = {
  /** Present for a POST; absent for a GET. */
  data?: unknown;
  /** Shown when the server fails without a message of its own. */
  fallback?: string;
  /** Shown when the request never reaches the server. */
  offline?: string;
  timeout?: number;
};

const notJson = {};

export async function api<T = Record<string, unknown>>(
  path: string,
  { data, fallback, offline, timeout = 15000 }: ApiOptions = {},
): Promise<T> {
  const fallbackMessage = fallback ?? '通信を確認してお試しください。';
  const response = await fetch(path, {
    method: data === undefined ? 'GET' : 'POST',
    headers:
      data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeout),
  }).catch(() => {
    throw new Error(offline ?? fallbackMessage);
  });

  const body = (await response.json().catch(() => notJson)) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const problem = new Error(
      typeof body.error === 'string' && body.error
        ? body.error
        : fallbackMessage,
    ) as ApiError;
    problem.status = response.status;
    if (typeof body.code === 'string') problem.code = body.code;
    throw problem;
  }
  return body as T;
}

/** True for the one failure a screen reacts to rather than reports. */
export const isUnauthorized = (problem: unknown) =>
  (problem as { status?: number }).status === 401;

/** The reason the API gave, when it gave one. */
export const errorCode = (problem: unknown) =>
  (problem as { code?: string }).code;

/** The message to show for a rejected promise, whatever it carries. */
export const errorMessage = (problem: unknown, fallback: string) =>
  problem instanceof Error && problem.message ? problem.message : fallback;
