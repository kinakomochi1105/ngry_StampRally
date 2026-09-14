import { detectLocale, type Locale } from './i18n';

/**
 * Maintenance mode: while MAINTENANCE_MODE=1, proxy.ts answers every
 * participant page and API with a real 503 before the request reaches the app.
 *
 * The page is one self-contained document, not a rendered route. A rewrite to
 * a Next page would still come back 200 (a proxy rewrite does not keep its
 * status), and maintenance is exactly when the app, the database or both may
 * be broken, so the answer must not depend on either. The organiser console
 * and its APIs are outside proxy.ts's matcher, so whoever turned maintenance
 * on can still reach everything.
 */

/** The API answer, shown by lib/client.ts in place of its own fallback. */
export const maintenanceMessage =
  'ただいまメンテナンス中です。しばらくしてからもう一度お試しください。';

/** Seconds a browser or crawler is asked to wait before trying again. */
const retryAfterSeconds = 300;

/** `Accept-Language` as an ordered list, most preferred first. */
export function acceptedLanguages(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1])
        .find(Boolean);
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter(({ tag, q }) => tag && tag !== '*' && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag);
}

export function maintenanceResponse(request: Request): Response {
  const { pathname } = new URL(request.url);
  const headers = {
    'Cache-Control': 'no-store',
    'Retry-After': String(retryAfterSeconds),
  };
  if (pathname === '/api' || pathname.startsWith('/api/'))
    return Response.json(
      { error: maintenanceMessage, code: 'maintenance' },
      { status: 503, headers },
    );
  const locale = detectLocale(
    acceptedLanguages(request.headers.get('accept-language')),
  );
  return new Response(
    request.method === 'HEAD' ? null : maintenancePage(locale),
    {
      status: 503,
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
    },
  );
}

const copy = {
  ja: {
    title: 'メンテナンス中 | 文化祭スタンプラリー',
    heading: 'ただいまメンテナンス中です',
    lead: 'スタンプラリーを一時的にお休みしています。しばらくしてから、もう一度開いてください。',
    action: 'もう一度開く',
    help: '分からないときは受付の係員にお尋ねください。',
  },
  en: {
    title: 'Under maintenance | Festival Stamp Rally',
    heading: 'Under maintenance',
    lead: 'The stamp rally is paused for a little while. Please open this page again in a few minutes.',
    action: 'Try again',
    help: 'Ask a staff member at the reception desk if you are not sure.',
  },
} satisfies Record<Locale, Record<string, string>>;

/**
 * Both languages are in the document; the one the request prefers is shown,
 * and a stored choice from the language menu wins once the script runs. The
 * palette mirrors app/styles/tokens.css, which this page cannot load.
 */
export function maintenancePage(locale: Locale) {
  const block = (lang: Locale) => `
      <div class="copy" lang="${lang}"${lang === locale ? '' : ' hidden'}>
        <h1>${copy[lang].heading}</h1>
        <p class="lead">${copy[lang].lead}</p>
        <a class="action" href="">${copy[lang].action}</a>
        <small>${copy[lang].help}</small>
      </div>`;
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f5fb" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0e17" />
    <title>${copy[locale].title}</title>
    <link rel="icon" href="/favicon.svg" />
    <script>try{var t=localStorage.getItem('festival-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
    <style>
      :root {
        color-scheme: light;
        --page-bg: #f3f5fb;
        --surface: #ffffff;
        --ink: #161a2b;
        --muted-ink: #596076;
        --faint-ink: #838ba4;
        --line: #e0e4f0;
        --brand: #4f46e5;
        --brand-strong: #4338ca;
        --brand-ink: #ffffff;
        --brand-soft: #ebeafe;
        --brand-line: #c7c4f8;
        --focus-ring: 0 0 0 3px #e0a11255;
        --shadow: 0 4px 14px -4px #131b361f, 0 2px 4px -2px #131b3614;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme='light']) {
          color-scheme: dark;
          --page-bg: #0b0e17;
          --surface: #141926;
          --ink: #eef1fb;
          --muted-ink: #a2abc4;
          --faint-ink: #7b849c;
          --line: #2a3145;
          --brand: #6366f1;
          --brand-strong: #7c7ff5;
          --brand-soft: #232744;
          --brand-line: #3d4275;
          --focus-ring: 0 0 0 3px #f2c14e4d;
          --shadow: 0 4px 14px -4px #0000007a, 0 2px 4px -2px #00000052;
        }
      }
      :root[data-theme='light'] { color-scheme: light; }
      :root[data-theme='dark'] {
        color-scheme: dark;
        --page-bg: #0b0e17;
        --surface: #141926;
        --ink: #eef1fb;
        --muted-ink: #a2abc4;
        --faint-ink: #7b849c;
        --line: #2a3145;
        --brand: #6366f1;
        --brand-strong: #7c7ff5;
        --brand-soft: #232744;
        --brand-line: #3d4275;
        --focus-ring: 0 0 0 3px #f2c14e4d;
        --shadow: 0 4px 14px -4px #0000007a, 0 2px 4px -2px #00000052;
      }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      body {
        display: grid;
        place-items: center;
        min-height: 100dvh;
        margin: 0;
        padding: 24px max(16px, env(safe-area-inset-left));
        background: var(--page-bg);
        color: var(--ink);
        font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, system-ui, sans-serif;
        -webkit-text-size-adjust: 100%;
      }
      main {
        display: grid;
        justify-items: center;
        gap: 14px;
        width: 100%;
        max-width: 520px;
        padding: 36px 22px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: radial-gradient(120% 90% at 50% 0%, var(--brand-soft) 0%, transparent 60%), var(--surface);
        text-align: center;
        box-shadow: var(--shadow);
      }
      /* The same pressed stamp as components/error-screen.tsx. */
      .stamp { margin: 0 0 4px; transform: rotate(-8deg); }
      .stamp > span {
        display: grid;
        place-content: center;
        gap: 4px;
        width: 132px;
        height: 132px;
        border: 3px solid var(--brand);
        border-radius: 50%;
        outline: 1.5px solid var(--brand-line);
        outline-offset: 5px;
        color: var(--brand);
      }
      .stamp strong { font-size: 2.6rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
      .stamp small { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; }
      .copy { display: grid; justify-items: center; gap: 14px; width: 100%; }
      h1 { margin: 4px 0 0; font-size: clamp(1.25rem, 1rem + 1vw, 1.5rem); line-height: 1.4; }
      .lead { margin: 0; font-size: 0.9375rem; line-height: 1.75; color: var(--muted-ink); }
      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 360px;
        min-height: 52px;
        margin-top: 6px;
        padding: 0 18px;
        border-radius: 14px;
        background: var(--brand);
        color: var(--brand-ink);
        font-size: 1.0625rem;
        font-weight: 700;
        text-decoration: none;
        box-shadow: var(--shadow);
      }
      .action:hover { background: var(--brand-strong); }
      .action:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .copy small { color: var(--faint-ink); font-size: 0.8125rem; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <p class="stamp" aria-hidden="true">
        <span><strong>503</strong><small>MAINTENANCE</small></span>
      </p>${block('ja')}${block('en')}
    </main>
    <script>try{var l=localStorage.getItem('festival-language');if(l==='ja'||l==='en'){document.querySelectorAll('.copy').forEach(function(e){e.hidden=e.lang!==l});document.documentElement.lang=l;document.title=${JSON.stringify(copy)}[l].title}}catch(e){}</script>
  </body>
</html>
`;
}
