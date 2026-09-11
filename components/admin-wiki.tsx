'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/language';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileCode,
  Printer,
  Search,
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
type Heading = { id: string; level: number; text: string };
type Page = Meta & {
  html: string;
  headings: Heading[];
  markdown: string;
  previous: Meta | null;
  next: Meta | null;
};
type Hit = Meta & { snippet: string };
type Index = { sections: Section[]; count: number; updated: string };
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
function WikiDoc({
  page,
  onOpen,
  onError,
}: {
  page: Page;
  onOpen: (slug: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useI18n();
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const { previous, next } = page;
  return (
    <article className="wiki-doc">
      <div className="wiki-doc-head">
        <span className="type-tag">{page.category}</span>
        <h3>{page.title}</h3>
        <p>{page.summary}</p>
        <dl>
          <div>
            <dt>{t('対象')}</dt>
            <dd>{page.audience}</dd>
          </div>
          <div>
            <dt>{t('最終更新')}</dt>
            <dd>{page.updated}</dd>
          </div>
          <div>
            <dt>{t('ファイル')}</dt>
            <dd>
              <code>{page.file}</code>
            </dd>
          </div>
        </dl>
        {page.tags.length > 0 && (
          <ul className="wiki-tags">
            {page.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
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
        </div>
      </div>
      {!raw && page.headings.length > 1 && (
        <details className="wiki-toc" open>
          <summary>
            <BookOpen size={16} />
            {t('このページの目次')}
          </summary>
          <ul>
            {page.headings
              .filter((heading) => heading.level <= 3)
              .map((heading) => (
                <li key={heading.id} data-level={heading.level}>
                  <a href={'#' + heading.id}>{heading.text}</a>
                </li>
              ))}
          </ul>
        </details>
      )}
      {raw ? (
        <div className="wiki-raw">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(page.markdown);
                setCopied(true);
              } catch {
                onError(
                  'この端末ではコピーできません。Markdownを選択してコピーしてください。',
                );
              }
            }}
          >
            <Copy size={16} />
            {copied ? t('コピーしました') : t('Markdownをコピー')}
          </Button>
          <pre>{page.markdown}</pre>
        </div>
      ) : (
        // Links between manual pages carry the target slug instead of a URL, so
        // one handler on the body opens them without leaving the admin screen.
        // The click always starts on an <a>, which the keyboard activates too,
        // so this listener needs no key handler of its own.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="wiki-body"
          onClick={(e) => {
            const link = (e.target as HTMLElement).closest('a[data-slug]');
            const target = link?.getAttribute('data-slug');
            if (!target) return;
            e.preventDefault();
            onOpen(target);
          }}
          // Rendered by lib/markdown.ts, which escapes the markdown source
          // before inserting the tags it supports, so nothing in the file can
          // reach the page as markup.
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      )}
      <nav className="wiki-nav" aria-label={t('前後のページ')}>
        {previous ? (
          <button type="button" onClick={() => onOpen(previous.slug)}>
            <ChevronLeft size={18} />
            <span>
              <small>{t('前のページ')}</small>
              <strong>{previous.title}</strong>
            </span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            className="next"
            onClick={() => onOpen(next.slug)}
          >
            <span>
              <small>{t('次のページ')}</small>
              <strong>{next.title}</strong>
            </span>
            <ChevronRight size={18} />
          </button>
        )}
      </nav>
    </article>
  );
}
/**
 * Wiki over `content/manual/*.md`, served through the admin API because the
 * administrator cookie is scoped to `/api/admin`.
 */
export function AdminWiki({ onDenied }: { onDenied?: (e: unknown) => void }) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState<Index | null>(null);
  const [slug, setSlug] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const failure = useCallback(
    (e: unknown) => {
      setError(
        e instanceof Error ? e.message : '通信を確認してお試しください。',
      );
      if ((e as { status?: number }).status === 401) onDenied?.(e);
    },
    [onDenied],
  );
  useEffect(() => {
    let active = true;
    // The first page opens by default so the panel is never empty.
    // eslint-disable-next-line react/react-compiler
    manual('')
      .then((data) => {
        if (!active) return;
        const value = data as unknown as Index;
        setIndex(value);
        setSlug(
          (current) => current || (value.sections[0]?.pages[0]?.slug ?? ''),
        );
      })
      .catch((e: unknown) => {
        if (active) failure(e);
      });
    return () => {
      active = false;
    };
  }, [failure]);
  useEffect(() => {
    if (!slug) return;
    let active = true;
    // The page body is fetched when the selection changes, so the busy flag is
    // part of starting that request.
    // eslint-disable-next-line react/react-compiler
    setBusy(true);
    manual('?slug=' + encodeURIComponent(slug))
      .then((data) => {
        if (!active) return;
        setPage(data.page as Page);
        setError('');
      })
      .catch((e: unknown) => {
        if (active) failure(e);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [slug, failure]);
  const open = (next: string) => {
    setHits(null);
    setQuery('');
    setSlug(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function find(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = query.trim();
    if (!term) {
      setHits(null);
      return;
    }
    setBusy(true);
    try {
      const data = await manual('?q=' + encodeURIComponent(term));
      setHits(data.results as Hit[]);
      setError('');
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel wiki-panel">
      <div className="panel-title">
        <div>
          <h2>{t('運営マニュアル')}</h2>
          <p>
            {t(
              '運営・受付・安全・技術など、視点ごとのマニュアルを収録しています。本文はリポジトリのMarkdownです。',
            )}
          </p>
        </div>
        {index && (
          <small className="wiki-count">
            {index.count}
            {t('ページ')} · {t('最終更新')} {index.updated}
          </small>
        )}
      </div>
      <form className="wiki-search" onSubmit={find}>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label={t('マニュアルを検索')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('例：QRコード / 復旧コード / 暗証番号')}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {t('検索')}
        </Button>
        {hits && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHits(null);
              setQuery('');
            }}
          >
            <X size={16} />
            {t('検索を解除')}
          </Button>
        )}
      </form>
      {error && <output className="form-error">{t(error)}</output>}
      {locale === 'en' && (
        <p className="wiki-language-note">
          {t('マニュアル本文は日本語のまま表示します。')}
        </p>
      )}
      <div className="wiki-layout">
        <nav className="wiki-side" aria-label={t('マニュアルの目次')}>
          {(index?.sections ?? []).map((section) => (
            <div key={section.category}>
              <h3>{section.category}</h3>
              <ul>
                {section.pages.map((entry) => (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      className={
                        entry.slug === slug && !hits ? 'active' : undefined
                      }
                      aria-current={
                        entry.slug === slug && !hits ? 'page' : undefined
                      }
                      onClick={() => open(entry.slug)}
                    >
                      <strong>{entry.title}</strong>
                      <small>{entry.audience}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="wiki-main">
          {hits ? (
            <div className="wiki-results">
              <h3>
                {hits.length}
                {t('件の検索結果')}
              </h3>
              {hits.length === 0 ? (
                <p className="empty-state">
                  {t(
                    '該当するページはありません。語句を短くしてお試しください。',
                  )}
                </p>
              ) : (
                <ul>
                  {hits.map((hit) => (
                    <li key={hit.slug}>
                      <button type="button" onClick={() => open(hit.slug)}>
                        <strong>{hit.title}</strong>
                        <span>
                          {hit.category} · {hit.audience}
                        </span>
                        <small>{hit.snippet}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : page ? (
            <WikiDoc
              key={page.slug}
              page={page}
              onOpen={open}
              onError={setError}
            />
          ) : (
            <p className="empty-state">
              {busy ? t('読み込み中…') : t('ページを選んでください。')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
