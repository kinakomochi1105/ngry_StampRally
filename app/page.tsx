'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Stamp, Trophy } from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Enrollment } from '@/components/enrollment';
import { FloorMap } from '@/components/floor-map';
import { RallyDemo } from '@/components/rally-demo';
import { Scanner } from '@/components/scanner';
import {
  RecoveryCodeDialog,
  RecoveryLogin,
  type RecoveryReceipt,
} from '@/components/recovery';
import { RewardClaimDialog, type Redemption } from '@/components/reward';
import { HelpCenter } from '@/components/participant/help-center';
import { PassportCard } from '@/components/participant/passport-card';
import { PlacesList } from '@/components/participant/places-list';
import {
  RallyBottomNav,
  RallyRail,
  type RallyTab,
} from '@/components/participant/rally-nav';
import { RewardPanel } from '@/components/participant/reward-panel';
import { StampBook } from '@/components/participant/stamp-book';
import { useLocationsTool, usePassport } from '@/hooks/use-passport';

/** Heading and one line of guidance for each screen of the rally panel. */
const panelCopy: Record<RallyTab, { title: string; hint: string }> = {
  book: {
    title: 'スタンプ帳',
    hint: '設置場所に着いたら、QRコードを読み取りましょう。',
  },
  places: {
    title: '設置場所',
    hint: '教室と案内を確認してから、スポットへ向かいましょう。',
  },
  map: {
    title: 'フロアマップ',
    hint: '階を選ぶと、設置場所と現在の混み具合を確認できます。',
  },
  rewards: {
    title: '報酬まで',
    hint: 'コンプリートまで、あとどれくらい？',
  },
};

export default function Home() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<RallyTab>('book');
  const [scanning, setScanning] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [demo, setDemo] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const [receipt, setReceipt] = useState<RecoveryReceipt | null>(null);

  // A stamp can arrive while another screen is open — from the scanner, or
  // from a poster link. Land on the book so it is visible while it animates.
  const showBook = useCallback(() => setTab('book'), []);
  const showPlaces = useCallback(() => setTab('places'), []);
  const {
    data,
    loading,
    failed,
    notice,
    pendingStamp,
    freshStamp,
    clearFreshStamp,
    toast,
    reload,
    scan,
    applyRedemption,
  } = usePassport({ onCollected: showBook });

  const { profile, spots, settings, stamps, traffic } = data;
  const total = spots.length;
  const count = stamps.filter((s) =>
    spots.some((p) => p.id === s.spotId),
  ).length;
  const complete = total > 0 && count === total;
  const hasStamp = (spotId: string) => stamps.some((s) => s.spotId === spotId);
  const redemption: Redemption | null = profile?.redeemedAt
    ? { redeemedAt: profile.redeemedAt, completedAt: profile.completedAt }
    : null;

  const show = useCallback((next: RallyTab) => {
    setTab(next);
    document.getElementById('rally-panel')?.scrollIntoView({ block: 'start' });
  }, []);
  useLocationsTool(spots, showPlaces);

  const closeScanner = useCallback(() => setScanning(false), []);
  const registered = async (value?: RecoveryReceipt) => {
    if (value) setReceipt(value);
    await reload();
  };

  const navProps = {
    tab,
    complete,
    scanDisabled: failed || loading || !total,
    onSelect: show,
    onScan: () => setScanning(true),
  };

  return (
    <main className="participant-app">
      <a className="skip-link" href="#main-content">
        {t('本文へ移動')}
      </a>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Stamp size={21} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <strong>{settings.title}</strong>
            <small>STAMP RALLY</small>
          </span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
      </header>

      <div className="app-body">
        {profile && <RallyRail {...navProps} />}
        <div className="app-main" id="main-content">
          {notice && (
            <output className={failed ? 'notice error' : 'notice'}>
              <span>{t(notice)}</span>
              {failed && (
                <button onClick={() => void reload()} disabled={loading}>
                  {t('再読み込み')}
                </button>
              )}
            </output>
          )}

          {loading && !profile ? (
            <output
              className="passport-skeleton"
              aria-label={t('参加情報を読み込み中…')}
            >
              <span className="skeleton-line skeleton-eyebrow" />
              <span className="skeleton-line skeleton-title" />
              <div className="skeleton-card">
                <span className="skeleton-line skeleton-row" />
                <span className="skeleton-line skeleton-bar" />
                <span className="skeleton-line skeleton-row short" />
              </div>
            </output>
          ) : !failed && !profile ? (
            <>
              {pendingStamp && (
                <output className="notice">
                  <span>
                    {t(
                      'QRコードを読み取りました。参加登録が終わると、このスタンプを自動で押します。',
                    )}
                  </span>
                </output>
              )}
              <div className="access-tabs">
                <button
                  aria-pressed={!loginMode}
                  className={loginMode ? '' : 'active'}
                  onClick={() => setLoginMode(false)}
                >
                  {t('初めての方')}
                </button>
                <button
                  aria-pressed={loginMode}
                  className={loginMode ? 'active' : ''}
                  onClick={() => setLoginMode(true)}
                >
                  {t('登録済みの方・再ログイン')}
                </button>
              </div>
              {loginMode ? (
                <RecoveryLogin onRestored={reload} />
              ) : (
                <Enrollment
                  settings={settings}
                  onRegistered={async (value) => {
                    if (value) setDemoPending(true);
                    await registered(value);
                  }}
                />
              )}
            </>
          ) : profile ? (
            <>
              <PassportCard
                profile={profile}
                count={count}
                total={total}
                celebrate={freshStamp !== null}
              />

              <section
                id="rally-panel"
                className="rally-panel"
                aria-label={t('スタンプラリー')}
              >
                <div className="panel-swap" key={tab}>
                  <div className="panel-head">
                    <h2 className="rally-panel-title">
                      {t(panelCopy[tab].title)}
                    </h2>
                    <p className="panel-instructions">
                      {t(panelCopy[tab].hint)}
                    </p>
                  </div>
                  {tab === 'rewards' ? (
                    <RewardPanel
                      count={count}
                      total={total}
                      redemption={redemption}
                      onClaim={() => setClaiming(true)}
                      onFindNext={() => show('places')}
                    />
                  ) : tab === 'map' ? (
                    <>
                      <FloorMap
                        spots={spots}
                        traffic={traffic}
                        hasStamp={hasStamp}
                        locale={locale}
                      />
                      <Button
                        className="map-back-button"
                        variant="outline"
                        onClick={() => setTab('places')}
                      >
                        {t('設置場所一覧へ戻る')}
                      </Button>
                    </>
                  ) : total === 0 ? (
                    <div className="empty-state">
                      {t('設置場所の準備ができるまでお待ちください。')}
                    </div>
                  ) : tab === 'book' ? (
                    <StampBook
                      spots={spots}
                      hasStamp={hasStamp}
                      freshStamp={freshStamp}
                      onSettled={clearFreshStamp}
                    />
                  ) : (
                    <PlacesList
                      spots={spots}
                      traffic={traffic}
                      hasStamp={hasStamp}
                      onOpenMap={() => setTab('map')}
                    />
                  )}
                </div>
              </section>

              <HelpCenter
                nickname={profile.nickname}
                onShowDemo={() => setDemo(true)}
                onIssued={registered}
                onLoggedOut={async () => {
                  setLoginMode(true);
                  await reload();
                }}
              />

              <Scanner open={scanning} onClose={closeScanner} onScan={scan} />
              <RewardClaimDialog
                open={claiming}
                onClose={() => setClaiming(false)}
                onRedeemed={(value) => {
                  setClaiming(false);
                  applyRedemption(value);
                }}
              />
            </>
          ) : null}

          {receipt && (
            <RecoveryCodeDialog
              receipt={receipt}
              onClose={() => {
                setReceipt(null);
                if (demoPending) {
                  setDemo(true);
                  setDemoPending(false);
                }
              }}
            />
          )}
          {demo && !receipt && <RallyDemo onClose={() => setDemo(false)} />}

          <footer>
            <span>{t('生徒会総務部')}</span>
            <span>{t('歩きスマホはお控えください。')}</span>
          </footer>
        </div>
      </div>

      {profile && <RallyBottomNav {...navProps} />}

      <output
        className="rally-toast-area"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <span key={toast.at} className={`rally-toast ${toast.tone}`}>
            {toast.tone === 'success' ? (
              <Trophy size={18} aria-hidden="true" />
            ) : (
              <Check size={18} aria-hidden="true" />
            )}
            {t(toast.text)}
          </span>
        )}
      </output>
    </main>
  );
}
