'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n, LanguageSelect } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode,
  House,
  ListTree,
  Menu,
  Printer,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
type Meta = {
  slug: string;
  title: string;
  category: string;
  audience: string;
  summary: string;
  updated: string;
  tags: string[];
  file: string;
};
type Section = { category: string; pages: Meta[] };
type Index = { sections: Section[]; count: number; updated: string };
type Heading = { id: string; level: number; text: string };
type Article = Meta & {
  html: string;
  headings: Heading[];
  markdown: string;
  previous: Meta | null;
  next: Meta | null;
};
type Hit = Meta & { snippet: string };
export const wikiPath = (slug: string) => '/admin/wiki/' + slug;
async function manual(query: string) {
  const r = await fetch('/api/admin/manual' + query, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    const error = new Error(
      typeof data.error === 'string'
        ? data.error
        : 'マニュアルを読み込めませんでした。',
    ) as Error & { status: number };
    error.status = r.status;
    throw error;
  }
  return data;
}
const isDenied = (e: unknown) => (e as { status?: number }).status === 401;
const message = (e: unknown) =>
  e instanceof Error ? e.message : '通信を確認してお試しください。';
/** The index backs the sidebar, the landing page and the search box. */
function useManualIndex() {
  const [index, setIndex] = useState<Index | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    // The admin cookie is scoped to /api/admin, so the session can only be
    // checked by asking the API.
    // eslint-disable-next-line react/react-compiler
    manual('')
      .then((data) => {
        if (active) setIndex(data as unknown as Index);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setDenied(isDenied(e));
        setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return { index, denied, error };
}
/**
 * Search runs while typing. The query goes to the server so the body text of
 * every page is searched, not just the titles held in the index.
 */
function WikiSearch({
  hits,
  onHits,
  onFailure,
}: {
  hits: Hit[] | null;
  onHits: (hits: Hit[] | null) => void;
  onFailure: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      onHits(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      void manual('?q=' + encodeURIComponent(term))
        .then((data) => {
          if (active) onHits(data.results as Hit[]);
        })
        .catch((e: unknown) => {
          if (active) onFailure(e);
        });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, onHits, onFailure]);
  useEffect(() => {
    // "/" jumps to the search box and Escape clears it, the way a wiki behaves.
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        box.current?.focus();
      }
      if (event.key === 'Escape' && typing && target === box.current)
        setQuery('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="wiki-search">
      <Search size={17} aria-hidden="true" />
      <input
        ref={box}
        type="search"
        aria-label={t('マニュアルを検索')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('マニュアルを検索')}
      />
      {hits !== null && (
        <output className="wiki-search-count">
          {hits.length}
          {t('件')}
        </output>
      )}
      {query ? (
        <button
          type="button"
          className="wiki-search-clear"
          aria-label={t('検索を解除')}
          onClick={() => setQuery('')}
        >
          <X size={15} />
        </button>
      ) : (
        <kbd className="wiki-search-key" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  );
}
function WikiHits({ hits }: { hits: Hit[] }) {
  const { t } = useI18n();
  if (!hits.length)
    return (
      <p className="wiki-empty">
        {t('該当するページはありません。語句を短くしてお試しください。')}
      </p>
    );
  return (
    <ul className="wiki-hits">
      {hits.map((hit) => (
        <li key={hit.slug}>
          <Link href={wikiPath(hit.slug)}>
            <strong>{hit.title}</strong>
            <span>
              {hit.category} · {hit.audience}
            </span>
            <small>{hit.snippet}</small>
          </Link>
        </li>
      ))}
    </ul>
  );
}
/**
 * The page list on the left. Each category folds away the way a documentation
 * site behaves; every category starts open so the whole manual is visible.
 */
function WikiNav({
  sections,
  slug,
  onNavigate,
}: {
  sections: Section[];
  slug: string;
  onNavigate?: () => void;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  return (
    <>
      {sections.map((section) => {
        const open = !closed.includes(section.category);
        return (
          <div key={section.category} className="wiki-nav-group">
            <button
              type="button"
              className="wiki-nav-group-head"
              aria-expanded={open}
              onClick={() =>
                setClosed((previous) =>
                  open
                    ? [...previous, section.category]
                    : previous.filter((name) => name !== section.category),
                )
              }
            >
              <span>{section.category}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {open && (
              <ul>
                {section.pages.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={wikiPath(entry.slug)}
                      onClick={onNavigate}
                      className={entry.slug === slug ? 'active' : undefined}
                      aria-current={entry.slug === slug ? 'page' : undefined}
                    >
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
function WikiToc({ headings }: { headings: Heading[] }) {
  return (
    <ul>
      {headings
        .filter((heading) => heading.level <= 3)
        .map((heading) => (
          <li key={heading.id} data-level={heading.level}>
            <a href={'#' + heading.id}>{heading.text}</a>
          </li>
        ))}
    </ul>
  );
}
function WikiSkeleton() {
  return (
    <div className="wiki-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
/** Breadcrumbs: the home icon, then where the reader is now. */
function WikiCrumbs({ trail }: { trail: string[] }) {
  const { t } = useI18n();
  return (
    <nav className="wiki-crumbs" aria-label={t('現在位置')}>
      <Link href="/admin/wiki" aria-label={t('運営マニュアル')}>
        <House size={15} aria-hidden="true" />
      </Link>
      {trail.map((step, position) => (
        <span key={step}>
          <ChevronRight size={13} aria-hidden="true" />
          <span
            className={position === trail.length - 1 ? 'current' : undefined}
          >
            {step}
          </span>
        </span>
      ))}
    </nav>
  );
}
/**
 * Shared chrome: the top bar with the search box, the page list on the left
 * and the article column beside it.
 */
function WikiShell({
  slug = '',
  children,
}: {
  slug?: string;
  children: (index: Index) => React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const { index, denied, error } = useManualIndex();
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [menu, setMenu] = useState(false);
  const onFailure = useCallback((e: unknown) => {
    setSearchError(message(e));
  }, []);
  const closeMenu = useCallback(() => setMenu(false), []);
  useEffect(() => {
    // On a phone the page list opens over the article, so Escape closes it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const notice = searchError || error;
  return (
    <div className="wiki-app">
      <header className="wiki-topbar">
        {!denied && (
          <button
            type="button"
            className="wiki-menu-button"
            aria-expanded={menu}
            aria-controls="wiki-sidebar"
            aria-label={t('マニュアルの一覧')}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
        <Link href="/admin/wiki" className="wiki-brand">
          <span className="wiki-brand-mark">
            <BookOpen size={17} aria-hidden="true" />
          </span>
          {t('運営マニュアル')}
        </Link>
        <nav className="wiki-top-links" aria-label={t('サイト内の移動')}>
          <Link href="/admin/wiki" className={slug ? undefined : 'active'}>
            {t('ドキュメント')}
          </Link>
          <Link
            href={wikiPath('troubleshooting')}
            className={slug === 'troubleshooting' ? 'active' : undefined}
          >
            {t('当日の対応')}
          </Link>
          <Link href="/admin">{t('管理センター')}</Link>
        </nav>
        {!denied && (
          <WikiSearch hits={hits} onHits={setHits} onFailure={onFailure} />
        )}
        <div className="wiki-top-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
      </header>
      {denied ? (
        <main className="wiki-denied">
          <ShieldCheck size={30} aria-hidden="true" />
          <h2>{t('管理者ログインが必要です。')}</h2>
          <p>{t('管理センターでログインしてから開いてください。')}</p>
          <Button render={<Link href="/admin" />}>
            {t('管理者ログインへ')}
          </Button>
        </main>
      ) : (
        <div className="wiki-frame">
          <aside
            id="wiki-sidebar"
            className="wiki-side"
            data-open={menu ? 'true' : undefined}
            aria-label={t('マニュアルの一覧')}
          >
            {index ? (
              <WikiNav
                sections={index.sections}
                slug={slug}
                onNavigate={closeMenu}
              />
            ) : (
              <WikiSkeleton />
            )}
          </aside>
          <button
            type="button"
            className="wiki-scrim"
            hidden={!menu}
            tabIndex={-1}
            aria-hidden="true"
            onClick={closeMenu}
          />
          <main className="wiki-main">
            {notice && <output className="form-error">{t(notice)}</output>}
            {locale === 'en' && (
              <p className="wiki-language-note">
                {t('マニュアル本文は日本語のまま表示します。')}
              </p>
            )}
            {!index ? (
              <WikiSkeleton />
            ) : hits !== null ? (
              <>
                <WikiCrumbs trail={[t('検索結果')]} />
                <h1 className="wiki-title">{t('検索結果')}</h1>
                <WikiHits hits={hits} />
              </>
            ) : (
              children(index)
            )}
            <footer className="wiki-foot">
              {t('管理者専用 · 参加者サイトからは開けません。')}
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
/** Landing page: the day-of shortcuts, then every category with its pages. */
export function WikiIndexPage() {
  const { t } = useI18n();
  return (
    <WikiShell>
      {(index) => {
        const pages = index.sections.flatMap((section) => section.pages);
        const quick = [
          'troubleshooting',
          'reception',
          'reward',
          'operation-day',
        ]
          .map((slug) => pages.find((page) => page.slug === slug))
          .filter((page): page is Meta => page !== undefined);
        return (
          <div className="wiki-landing">
            <WikiCrumbs trail={[t('ドキュメント')]} />
            <h1 className="wiki-title">{t('運営マニュアル')}</h1>
            <p className="wiki-lead">
              {t(
                '運営・受付・安全・技術など、視点ごとのマニュアルです。本文はリポジトリのMarkdownで管理しています。',
              )}
            </p>
            <dl className="wiki-meta">
              <div>
                <dt>{t('ページ数')}</dt>
                <dd>{index.count}</dd>
              </div>
              <div>
                <dt>{t('最終更新')}</dt>
                <dd>{index.updated}</dd>
              </div>
            </dl>
            {quick.length > 0 && (
              <section className="wiki-quick">
                <h2>{t('当日よく開くページ')}</h2>
                <div>
                  {quick.map((page) => (
                    <Link key={page.slug} href={wikiPath(page.slug)}>
                      <strong>{page.title}</strong>
                      <small>{page.audience}</small>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {index.sections.map((section) => (
              <section key={section.category} className="wiki-category">
                <h2>
                  {section.category}
                  <span>
                    {section.pages.length}
                    {t('ページ')}
                  </span>
                </h2>
                <div className="wiki-cards">
                  {section.pages.map((page) => (
                    <Link key={page.slug} href={wikiPath(page.slug)}>
                      <span className="type-tag">{page.audience}</span>
                      <strong>{page.title}</strong>
                      <small>{page.summary}</small>
                      {page.tags.length > 0 && (
                        <ul className="wiki-tags">
                          {page.tags.map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        );
      }}
    </WikiShell>
  );
}
/** One manual page, with its own table of contents and neighbours. */
export function WikiArticlePage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    // A 401 is reported once by the shell, which shows the sign-in card.
    // eslint-disable-next-line react/react-compiler
    manual('?slug=' + encodeURIComponent(slug))
      .then((data) => {
        if (active) setArticle(data.page as Article);
      })
      .catch((e: unknown) => {
        if (active && !isDenied(e)) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [slug]);
  if (error)
    return (
      <WikiShell slug={slug}>
        {() => <output className="form-error">{t(error)}</output>}
      </WikiShell>
    );
  return (
    <WikiShell slug={slug}>
      {() =>
        !article ? (
          <WikiSkeleton />
        ) : (
          <div className="wiki-doc-frame">
            <article className="wiki-doc">
              <WikiCrumbs trail={[article.category, article.title]} />
              <h1 className="wiki-title">{article.title}</h1>
              <p className="wiki-summary">{article.summary}</p>
              <div className="wiki-doc-meta">
                <span className="type-tag">{article.audience}</span>
                <span>
                  {t('最終更新')} {article.updated}
                </span>
                <code>{article.file}</code>
              </div>
              <div className="wiki-doc-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRaw(!raw);
                    setCopied(false);
                  }}
                >
                  <FileCode size={16} />
                  {raw ? t('本文を表示') : t('Markdownを表示')}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer size={16} />
                  {t('このページを印刷')}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(article.markdown);
                      setCopied(true);
                    } catch {
                      setError(
                        'この端末ではコピーできません。Markdownを表示して選択してください。',
                      );
                    }
                  }}
                >
                  <Copy size={16} />
                  {copied ? t('コピーしました') : t('Markdownをコピー')}
                </Button>
              </div>
              {!raw && article.headings.length > 1 && (
                <details className="wiki-toc-compact">
                  <summary>
                    <ListTree size={16} aria-hidden="true" />
                    {t('このページの目次')}
                  </summary>
                  <WikiToc headings={article.headings} />
                </details>
              )}
              {raw ? (
                <pre className="wiki-raw">{article.markdown}</pre>
              ) : (
                // Links between manual pages carry the target slug instead of a
                // URL. The click always starts on an <a>, which the keyboard
                // activates too, so this listener needs no key handler.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  className="wiki-body"
                  onClick={(e) => {
                    const link = (e.target as HTMLElement).closest(
                      'a[data-slug]',
                    );
                    const target = link?.getAttribute('data-slug');
                    if (!target) return;
                    e.preventDefault();
                    router.push(wikiPath(target));
                  }}
                  // Rendered by lib/markdown.ts, which escapes the markdown
                  // source before inserting the tags it supports, so nothing in
                  // the file can reach the page as markup.
                  dangerouslySetInnerHTML={{ __html: article.html }}
                />
              )}
              <nav className="wiki-steps" aria-label={t('前後のページ')}>
                {article.previous ? (
                  <Link href={wikiPath(article.previous.slug)}>
                    <ChevronLeft size={18} aria-hidden="true" />
                    <span>
                      <small>{t('前のページ')}</small>
                      <strong>{article.previous.title}</strong>
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {article.next && (
                  <Link href={wikiPath(article.next.slug)} className="next">
                    <span>
                      <small>{t('次のページ')}</small>
                      <strong>{article.next.title}</strong>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                )}
              </nav>
            </article>
            {!raw && article.headings.length > 1 && (
              <aside className="wiki-rail" aria-label={t('このページの目次')}>
                <h2>{t('このページの目次')}</h2>
                <WikiToc headings={article.headings} />
              </aside>
            )}
          </div>
        )
      }
    </WikiShell>
  );
}
