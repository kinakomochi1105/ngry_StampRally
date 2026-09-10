'use client';
import { useI18n, LanguageSelect } from '@/components/language';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RallyDemo } from '@/components/rally-demo';
import { Scanner } from '@/components/scanner';
import { Enrollment } from '@/components/enrollment';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  FloorMap,
  TrafficBadge,
  type TrafficPoint,
} from '@/components/floor-map';
import {
  RecoveryLogin,
  RecoverySetup,
  RecoveryCodeDialog,
  type RecoveryReceipt,
} from '@/components/recovery';
import {
  QrCode,
  MapPin,
  Stamp,
  Flag,
  Music,
  FlaskConical,
  Palette,
  Coffee,
  Theater,
  Check,
  ChevronRight,
  Trophy,
  Gift,
  Map as MapIcon,
  ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  defaultSettings,
  profileLabel,
  type Profile,
  type Spot,
  type FestivalSettings,
} from '@/lib/types';
const icons = [Flag, Palette, FlaskConical, Coffee, Music, Theater];
type Passport = {
  profile: Profile | null;
  spots: Spot[];
  settings: FestivalSettings;
  stamps: { spotId: string; createdAt: number }[];
  traffic: TrafficPoint[];
  error?: string;
};
export default function Home() {
  const { t, locale } = useI18n();
  const [demo, setDemo] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const [tab, setTab] = useState('book');
  const [data, setData] = useState<Passport>({
    profile: null,
    spots: [],
    settings: defaultSettings,
    stamps: [],
    traffic: [],
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loginMode, setLoginMode] = useState(false);
  const [receipt, setReceipt] = useState<RecoveryReceipt | null>(null);
  const [scanning, setScanning] = useState(false);
  const [freshStamp, setFreshStamp] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/passport', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const d = (await r.json()) as Passport;
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setFailed(false);
      setNotice('');
    } catch {
      setFailed(true);
      setNotice(
        'スタンプ帳を読み込めませんでした。通信を確認して再読み込みしてください。',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Server-backed registration and passport are loaded on first access.
    // eslint-disable-next-line react/react-compiler
    void reload();
  }, [reload]);
  async function registered(value?: RecoveryReceipt) {
    if (value) setReceipt(value);
    await reload();
  }
  async function loggedOut() {
    setLoginMode(true);
    await reload();
  }
  const close = useCallback(() => setScanning(false), []);
  const scan = useCallback(async (code: string) => {
    const r = await fetch('/api/stamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new Error('通信を確認して、同じQRで再試行してください。');
    });
    const d = (await r.json()) as {
      error?: string;
      spotId: string;
      duplicate: boolean;
    };
    if (!r.ok) throw new Error(d.error);
    if (!d.duplicate) setFreshStamp(d.spotId);
    setData((current) => ({
      ...current,
      stamps: current.stamps.some((s) => s.spotId === d.spotId)
        ? current.stamps
        : [
            ...current.stamps,
            { spotId: d.spotId, createdAt: Math.floor(Date.now() / 1000) },
          ],
    }));
    setNotice(
      d.duplicate ? 'このスタンプは獲得済みです。' : 'スタンプを獲得しました！',
    );
  }, []);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const life = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'show_stamp_locations',
            title: '設置場所一覧を開く',
            description:
              '場所の一覧を表示します。参加者の個人情報は返しません。',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('空のオブジェクトを指定してください。');
              setTab('places');
              return {
                spots: data.spots.map((s) => ({
                  name: s.name,
                  location: s.location,
                })),
              };
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [data.spots]);
  const { profile, spots, settings, stamps, traffic } = data;
  const total = spots.length;
  const count = stamps.filter((s) =>
    spots.some((p) => p.id === s.spotId),
  ).length;
  const complete = total > 0 && count === total;
  const has = (id: string) => stamps.some((s) => s.spotId === id);
  const trafficFor = (id: string) =>
    traffic.find((point) => point.spotId === id)?.recentCount ?? 0;
  const profileId = profile?.id;
  const navItems = [
    {
      id: 'book',
      Icon: Stamp,
      label: locale === 'en' ? 'Stamp book' : 'スタンプ帳',
    },
    {
      id: 'places',
      Icon: ScanLine,
      label: locale === 'en' ? 'Locations' : '設置場所',
    },
    {
      id: 'rewards',
      Icon: Gift,
      label: locale === 'en' ? 'Rewards' : '特典',
    },
  ];
  const isNavActive = (id: string) =>
    id === 'places' ? tab === 'places' || tab === 'map' : tab === id;

  useEffect(() => {
    if (!profileId) return;
    const timer = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(timer);
  }, [profileId, reload]);
  return (
    <main className="participant-app">
      <a className="skip-link" href="#main-content">
        {locale === 'en' ? 'Skip to content' : '本文へ移動'}
      </a>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Stamp size={22} />
          </span>
          <span>
            {settings.title}
            <small>STAMP RALLY</small>
          </span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
      </header>
      <div className="mobile-page" id="main-content">
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
          <div className="loading-state">{t('参加情報を読み込み中…')}</div>
        ) : !failed && !profile ? (
          <>
            <div className="access-tabs">
              <button
                aria-pressed={!loginMode}
                className={!loginMode ? 'active' : ''}
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
            <div className="pass-heading">
              <div>
                <p>
                  {locale === 'en' ? 'YOUR FESTIVAL PASS' : 'あなたの参加証'}
                </p>
                <h1>{profile.nickname ?? profileLabel(profile, locale)}</h1>
                <small>{profileLabel(profile, locale)}</small>
              </div>
            </div>
            <section
              className="journey-summary"
              aria-label={locale === 'en' ? 'Your progress' : '現在の進み具合'}
            >
              <div className="journey-heading">
                <span>
                  {complete ? (
                    <Trophy
                      size={21}
                      className={freshStamp ? 'completion-pop' : undefined}
                    />
                  ) : (
                    <Stamp size={21} />
                  )}
                  <strong>
                    {complete ? t('コンプリート！') : t('集めたスタンプ')}
                  </strong>
                </span>
                <p>
                  <b>{count}</b>
                  <span> / {total}</span>
                </p>
              </div>
              <progress
                max={total || 1}
                value={count}
                aria-label={
                  locale === 'en' ? 'Stamps collected' : '集めたスタンプ'
                }
              />
              <p className="journey-message">
                {!total
                  ? t('スポットはただいま準備中です。')
                  : complete
                    ? t('全スポット達成、おめでとう！')
                    : locale === 'en'
                      ? total -
                        count +
                        ' stamps to go. Scan a QR code at each location.'
                      : 'あと' +
                        (total - count) +
                        '個。設置場所でQRを読み取ろう。'}
              </p>
            </section>
            <section
              id="rally-panel"
              className="rally-panel"
              aria-label={locale === 'en' ? 'Festival pass' : 'スタンプラリー'}
            >
              <h2 className="rally-panel-title">
                {tab === 'book'
                  ? locale === 'en'
                    ? 'Stamp book'
                    : 'スタンプ帳'
                  : tab === 'places'
                    ? t('設置場所')
                    : tab === 'map'
                      ? locale === 'en'
                        ? 'Floor map'
                        : 'フロアマップ'
                      : locale === 'en'
                        ? 'Reward progress'
                        : '報酬まで'}
              </h2>
              <p className="panel-instructions">
                {tab === 'book'
                  ? locale === 'en'
                    ? 'Find a location, then scan its QR code using the button below.'
                    : '設置場所に着いたら、下の「QRを読み取る」を押してください。'
                  : tab === 'places'
                    ? locale === 'en'
                      ? 'Check the room and directions before you start walking.'
                      : '教室と案内を確認してから、スポットへ向かいましょう。'
                    : tab === 'map'
                      ? locale === 'en'
                        ? 'Choose a floor to see every location and its current crowd guide.'
                        : '階を選ぶと、設置場所と現在の混み具合を確認できます。'
                      : locale === 'en'
                        ? 'Check your progress toward completing the rally.'
                        : 'コンプリートまで、あとどれくらい？'}
              </p>
              {tab === 'rewards' ? (
                <section className="reward-progress">
                  <span
                    className={
                      complete ? 'reward-symbol complete' : 'reward-symbol'
                    }
                  >
                    {complete ? <Trophy size={42} /> : <Gift size={42} />}
                  </span>
                  <p className="eyebrow">
                    {locale === 'en' ? 'YOUR PROGRESS' : 'コンプリートへの道'}
                  </p>
                  <h3>
                    {!total
                      ? locale === 'en'
                        ? 'Getting ready'
                        : 'ただいま準備中'
                      : complete
                        ? locale === 'en'
                          ? 'All stamps collected!'
                          : '全スタンプ達成！'
                        : locale === 'en'
                          ? 'Stamps to go'
                          : 'コンプリートまで'}
                  </h3>
                  {total > 0 && (
                    <>
                      <div className="reward-remaining">
                        <strong>{total - count}</strong>
                        <span>{locale === 'en' ? 'remaining' : '個'}</span>
                      </div>
                      <progress
                        value={count}
                        max={total}
                        aria-label={
                          locale === 'en' ? 'Stamp progress' : 'スタンプ達成率'
                        }
                      />
                      <p>
                        {count} / {total}{' '}
                        {locale === 'en' ? 'stamps collected' : 'スタンプ獲得'}
                      </p>
                    </>
                  )}
                  <p className="reward-description">
                    {complete
                      ? locale === 'en'
                        ? 'Congratulations on visiting every active location!'
                        : '公開中のスポットをすべて巡りました。おめでとうございます！'
                      : locale === 'en'
                        ? 'Collect a stamp at every active location to complete the rally.'
                        : '公開中のスポットでスタンプを集めて、コンプリートを目指しましょう。'}
                  </p>
                  <div className="reward-note">
                    <strong>
                      {locale === 'en' ? 'About rewards' : '報酬について'}
                    </strong>
                    <p>
                      {locale === 'en'
                        ? 'Please ask the festival organizers about rewards and how to receive them.'
                        : '報酬の内容・受け取り方法は、文化祭の運営案内をご確認ください。'}
                    </p>
                  </div>
                  {!complete && total > 0 && (
                    <Button variant="outline" onClick={() => setTab('places')}>
                      {locale === 'en'
                        ? 'Find your next location'
                        : '次の設置場所を確認'}
                      <ChevronRight size={17} />
                    </Button>
                  )}
                </section>
              ) : tab === 'map' ? (
                <>
                  <FloorMap
                    spots={spots}
                    traffic={traffic}
                    hasStamp={has}
                    locale={locale}
                  />
                  <Button
                    className="map-back-button"
                    variant="outline"
                    onClick={() => setTab('places')}
                  >
                    <MapPin size={17} />
                    {locale === 'en'
                      ? 'Back to locations'
                      : '設置場所一覧へ戻る'}
                  </Button>
                </>
              ) : total === 0 ? (
                <div className="empty-state">
                  {t('設置場所の準備ができるまでお待ちください。')}
                </div>
              ) : tab === 'book' ? (
                <div className="stamp-grid">
                  {spots.map((spot, i) => {
                    const Icon = icons[i % icons.length];
                    return (
                      <article
                        className={
                          (has(spot.id)
                            ? 'stamp-card collected'
                            : 'stamp-card') +
                          (freshStamp === spot.id ? ' freshly-stamped' : '')
                        }
                        key={spot.id}
                        onAnimationEnd={(e) => {
                          if (e.animationName === 'festival-stamp')
                            setFreshStamp(null);
                        }}
                      >
                        <span className="spot-number">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="stamp-circle">
                          <Icon size={34} strokeWidth={1.4} />
                        </div>
                        <h3>{spot.name}</h3>
                        <p>{spot.location}</p>
                        <span className="uncollected">
                          {has(spot.id) ? (
                            <>
                              <Check size={12} />
                              {t('獲得済み')}
                            </>
                          ) : (
                            t('未獲得')
                          )}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="places">
                  <div className="places-toolbar">
                    <div>
                      <strong>
                        {locale === 'en' ? 'Plan your route' : '巡る場所を選ぶ'}
                      </strong>
                      <small>
                        {locale === 'en'
                          ? 'Crowd hints refresh every minute.'
                          : '混み具合は1分ごとに更新されます。'}
                      </small>
                    </div>
                    <Button
                      className="map-open-button"
                      variant="outline"
                      onClick={() => setTab('map')}
                    >
                      <MapIcon size={17} />
                      {locale === 'en' ? 'Open map' : 'マップを見る'}
                    </Button>
                  </div>
                  {spots.map((spot, i) => (
                    <article key={spot.id}>
                      <span className="list-number">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3>{spot.name}</h3>
                        <p>
                          <MapPin size={14} /> {spot.location}
                        </p>
                        <p>{spot.description}</p>
                        <TrafficBadge
                          count={trafficFor(spot.id)}
                          locale={locale}
                        />
                      </div>
                      {has(spot.id) ? (
                        <Check
                          className="list-status"
                          aria-label={t('獲得済み')}
                          size={20}
                        />
                      ) : (
                        <ChevronRight size={18} className="list-status" />
                      )}
                    </article>
                  ))}
                  <Button className="print-list" onClick={() => window.print()}>
                    {t('設置場所一覧を印刷')}
                  </Button>
                </section>
              )}
            </section>
            <nav
              className="desktop-side-nav"
              aria-label={
                locale === 'en' ? 'Festival navigation' : '画面切り替え'
              }
            >
              <div className="desktop-nav-heading">
                <span>
                  {locale === 'en' ? 'RALLY MENU' : 'ラリー メニュー'}
                </span>
                <small>
                  {locale === 'en' ? 'Quick access' : 'すぐに切り替え'}
                </small>
              </div>
              <Button
                className="desktop-scan-button"
                disabled={failed || loading || !total}
                onClick={() => setScanning(true)}
              >
                <QrCode size={19} />
                {locale === 'en' ? 'Scan QR' : 'QRを読み取る'}
              </Button>
              <div className="desktop-side-tabs">
                {navItems.map(({ id, Icon, label }) => {
                  const active = isNavActive(id);
                  return (
                    <button
                      key={id}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        setTab(id);
                        document
                          .getElementById('rally-panel')
                          ?.scrollIntoView({ block: 'start' });
                      }}
                    >
                      <Icon size={20} />
                      <strong>{label}</strong>
                    </button>
                  );
                })}
              </div>
            </nav>
            <details
              className="help-center"
              open={!profile.nickname || undefined}
            >
              <summary>
                {locale === 'en'
                  ? 'Help & account'
                  : '使い方・再ログイン・参加データ'}
              </summary>{' '}
              <Button
                className="replay-demo"
                variant="outline"
                onClick={() => setDemo(true)}
              >
                {locale === 'en' ? 'Show how to play' : '使い方デモを見る'}
              </Button>
              <RecoverySetup
                nickname={profile.nickname}
                onIssued={registered}
                onLoggedOut={loggedOut}
              />
              <details className="policy">
                <summary>{t('参加データ・使い方について')}</summary>
                <p>
                  {t(
                    'サイト内の読み取りボタンから設置QRを読み取ります。ニックネームに加え、生徒は学年・組・出席番号、一般客は参加IDをスタンプ履歴とともに保存します。進行状況・ランキングは管理者のみ閲覧できます。氏名・連絡先・位置情報は収集せず、カメラ映像・画像も送信しません。Cookieの有効期間と履歴の表示期間は30日です。サーバーの記録は開催後に主催者が削除します。同じ端末・ブラウザでご参加ください。Cookieの削除後や端末変更時は、ニックネームと復旧コードで再ログインできます。復旧コードを紛失した場合は、元の端末で再発行するか受付へご相談ください。',
                  )}
                </p>
              </details>
            </details>
            <div className="rally-bottom-dock">
              <div className="scan-dock">
                <Button
                  className="primary-action"
                  disabled={failed || loading || !total}
                  onClick={() => setScanning(true)}
                >
                  <QrCode size={22} />
                  {t('QRを読み取る')}
                </Button>
                <small>{t('立ち止まってから、読み取りましょう。')}</small>
              </div>
              <nav
                className="rally-bottom-nav"
                aria-label={
                  locale === 'en' ? 'Festival navigation' : '画面切り替え'
                }
              >
                {navItems.map(({ id, Icon, label }) => {
                  const active = isNavActive(id);
                  return (
                    <button
                      key={id}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      aria-controls="rally-panel"
                      onClick={() => {
                        setTab(id);
                        document
                          .getElementById('rally-panel')
                          ?.scrollIntoView({ block: 'start' });
                      }}
                    >
                      <span>
                        <Icon size={22} />
                        {id === 'rewards' && complete && (
                          <i>
                            <Check size={10} />
                          </i>
                        )}
                      </span>
                      <strong>{label}</strong>
                    </button>
                  );
                })}
              </nav>
            </div>
            <Scanner open={scanning} onClose={close} onScan={scan} />
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
          <span>{t('文化祭実行委員会')}</span>
          <span>{t('歩きスマホはお控えください。')}</span>
        </footer>
      </div>
    </main>
  );
}
