'use client';
import Link from 'next/link';
import { RotateCw, Stamp } from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * The frame the error pages share: the participant top bar, then one centred
 * card with the status as a pressed stamp, what happened and the way out. It
 * fetches nothing, so it still draws when the API or the database is what
 * failed. Maintenance (503) is not here: proxy.ts answers it before the app
 * runs at all (lib/maintenance.ts).
 */
function ErrorFrame({
  code,
  label,
  children,
}: {
  code: string;
  label: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <main className="participant-app error-page">
      <a className="skip-link" href="#main-content">
        {t('本文へ移動')}
      </a>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Stamp size={21} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <strong>{t('文化祭スタンプラリー')}</strong>
            <small>STAMP RALLY</small>
          </span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
      </header>

      <div className="app-body">
        <div className="app-main" id="main-content">
          <section className="error-screen">
            <p className="error-stamp" aria-hidden="true">
              <span>
                <strong>{code}</strong>
                <small>{label}</small>
              </span>
            </p>
            {children}
            <small>{t('分からないときは受付の係員にお尋ねください。')}</small>
          </section>
        </div>
      </div>
    </main>
  );
}

/** 404: an address that matches no page (app/not-found.tsx). */
export function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <ErrorFrame code="404" label="NOT FOUND">
      <h1>{t('ページが見つかりません')}</h1>
      <p className="error-lead">
        {t(
          'URLが間違っているか、ページが移動した可能性があります。QRコードから開いた場合は、スタンプラリーの「読み取る」から読み取り直してください。',
        )}
      </p>
      <div className="error-actions">
        <Button
          className="primary-action"
          render={<Link href="/" />}
          nativeButton={false}
        >
          {t('スタンプラリーに戻る')}
        </Button>
        <Button
          variant="outline"
          render={<Link href="/help" />}
          nativeButton={false}
        >
          {t('使い方ガイド')}
        </Button>
      </div>
    </ErrorFrame>
  );
}

/**
 * 500: a page that threw while drawing (app/error.tsx, app/global-error.tsx).
 * The digest is what the server log prints beside the real error, so a
 * reception desk can match a visitor's screen to it.
 */
export function FailureScreen({
  digest,
  onRetry,
}: {
  digest?: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <ErrorFrame code="500" label="ERROR">
      <h1>{t('一時的に表示できません')}</h1>
      <p className="error-lead">
        {t(
          '画面の読み込み中に問題が起きました。集めたスタンプは消えていません。少し待ってから、もう一度読み込んでください。',
        )}
      </p>
      <div className="error-actions">
        <Button className="primary-action" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          {t('もう一度読み込む')}
        </Button>
        <Button
          variant="outline"
          render={<Link href="/" />}
          nativeButton={false}
        >
          {t('スタンプラリーに戻る')}
        </Button>
      </div>
      {digest && (
        <p className="error-digest">
          {t('エラーID')}: <code>{digest}</code>
        </p>
      )}
    </ErrorFrame>
  );
}
