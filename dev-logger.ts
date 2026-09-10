import type { Plugin } from 'vite';

/**
 * Problem highlighting for the dev server console.
 *
 * vinext already prints a Next.js-style line for every request, so this
 * deliberately does NOT log successful traffic — that would double every line.
 * It only re-surfaces the two things that are easy to miss while an event is
 * running: failed responses and slow ones, each with a wall-clock timestamp
 * (vinext's line has none) so it can be matched against a report from the desk.
 */

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== 'dumb' &&
  process.stdout.isTTY !== false;

const esc = String.fromCharCode(27);
const paint = (code: string, text: string) =>
  useColor ? `${esc}[${code}m${text}${esc}[0m` : text;

const dim = (t: string) => paint('2', t);
const bold = (t: string) => paint('1', t);
const red = (t: string) => paint('31', t);
const green = (t: string) => paint('32', t);
const yellow = (t: string) => paint('33', t);
const blue = (t: string) => paint('34', t);
const cyan = (t: string) => paint('36', t);

function statusColor(status: number) {
  if (status >= 500) return red;
  if (status >= 400) return yellow;
  if (status >= 300) return cyan;
  return green;
}

function methodColor(method: string) {
  if (method === 'GET') return blue;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH')
    return yellow;
  if (method === 'DELETE') return red;
  return dim;
}

/** Slow requests are what you actually want to spot in a wall of logs. */
function duration(ms: number) {
  const text =
    ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
  if (ms >= 1000) return red(text);
  if (ms >= 300) return yellow(text);
  return dim(text);
}

// Vite internals, source modules and static assets: useful only when debugging
// the build, and they drown out the handful of API calls that matter.
const noise =
  /^\/(@vite|@id|@fs|@react-refresh|node_modules|__vinext|favicon\.ico)|\.(css|m?js|ts|tsx|map|svg|png|jpe?g|woff2?|ico)(\?|$)/;

/** Anything slower than this is worth looking at on a phone over Wi-Fi. */
const slowMs = 1000;

export function devLogger(): Plugin {
  return {
    name: 'festival-dev-logger',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (noise.test(url)) return next();
        const started = performance.now();
        res.on('finish', () => {
          const status = res.statusCode;
          const elapsed = performance.now() - started;
          const failed = status >= 400;
          if (!failed && elapsed < slowMs) return;
          const marker = failed ? red('✗ FAIL') : yellow('▲ SLOW');
          console.log(
            [
              marker,
              dim(new Date().toTimeString().slice(0, 8)),
              methodColor(req.method ?? 'GET')((req.method ?? 'GET').padEnd(6)),
              statusColor(status)(bold(String(status))),
              url.length > 70 ? url.slice(0, 69) + '…' : url,
              duration(elapsed),
            ].join(' '),
          );
        });
        next();
      });
    },
  };
}
