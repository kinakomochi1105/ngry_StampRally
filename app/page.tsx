'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Scanner } from '@/components/scanner';
import { Enrollment } from '@/components/enrollment';
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
  Settings,
  Trophy,
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
  error?: string;
};
export default function Home() {
  const [tab, setTab] = useState('book');
  const [data, setData] = useState<Passport>({
    profile: null,
    spots: [],
    settings: defaultSettings,
    stamps: [],
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [scanning, setScanning] = useState(false);
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
  const { profile, spots, settings, stamps } = data;
  const total = spots.length;
  const count = stamps.filter((s) =>
    spots.some((p) => p.id === s.spotId),
  ).length;
  const complete = total > 0 && count === total;
  const has = (id: string) => stamps.some((s) => s.spotId === id);
  return (
    <main className="participant-app">
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
        <Link href="/admin" className="admin-link" aria-label="管理者ページ">
          <Settings size={19} />
        </Link>
      </header>
      <div className="mobile-page">
        {notice && (
          <output className={failed ? 'notice error' : 'notice'}>
            <span>{notice}</span>
            {failed && (
              <button onClick={() => void reload()} disabled={loading}>
                再読み込み
              </button>
            )}
          </output>
        )}
        {loading && !profile ? (
          <div className="loading-state">参加情報を読み込み中…</div>
        ) : !failed && !profile ? (
          <Enrollment settings={settings} onRegistered={reload} />
        ) : profile ? (
          <>
            <div className="participant-intro">
              <div>
                <p className="eyebrow">YOUR FESTIVAL PASS</p>
                <h1>
                  今日の発見を、
                  <br />
                  スタンプに。
                </h1>
              </div>
              <span className="participant-label">
                {profile.kind === 'student' ? 'STUDENT' : 'GUEST'}
                <strong>{profileLabel(profile)}</strong>
              </span>
            </div>
            <section
              className={
                complete ? 'mobile-progress achieved' : 'mobile-progress'
              }
            >
              <div>
                <span>{complete ? 'コンプリート！' : '集めたスタンプ'}</span>
                <p>
                  <strong>{count}</strong>
                  <span> / {total}</span>
                </p>
              </div>
              {complete ? (
                <Trophy size={44} />
              ) : (
                <div
                  className="progress-ring"
                  style={{
                    background: `conic-gradient(#fff ${total ? (count / total) * 100 : 0}%,#ffffff38 0)`,
                  }}
                >
                  <span>{total ? Math.round((count / total) * 100) : 0}%</span>
                </div>
              )}
              <div className="progress-foot">
                {complete
                  ? '全スポット達成、おめでとう！'
                  : total
                    ? `あと${total - count}か所。次のスポットへ出かけよう。`
                    : 'スポットはただいま準備中です。'}
              </div>
            </section>
            <div className="mobile-tabs">
              <button
                aria-pressed={tab === 'book'}
                className={tab === 'book' ? 'active' : ''}
                onClick={() => setTab('book')}
              >
                <Stamp size={18} />
                スタンプ帳
              </button>
              <button
                aria-pressed={tab === 'places'}
                className={tab === 'places' ? 'active' : ''}
                onClick={() => setTab('places')}
              >
                <MapPin size={18} />
                設置場所
              </button>
            </div>
            {total === 0 ? (
              <div className="empty-state">
                設置場所の準備ができるまでお待ちください。
              </div>
            ) : tab === 'book' ? (
              <div className="stamp-grid">
                {spots.map((spot, i) => {
                  const Icon = icons[i % icons.length];
                  return (
                    <article
                      className={
                        has(spot.id) ? 'stamp-card collected' : 'stamp-card'
                      }
                      key={spot.id}
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
                            獲得済み
                          </>
                        ) : (
                          '未獲得'
                        )}
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="places">
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
                    </div>
                    {has(spot.id) ? (
                      <Check
                        className="list-status"
                        aria-label="獲得済み"
                        size={20}
                      />
                    ) : (
                      <ChevronRight size={18} className="list-status" />
                    )}
                  </article>
                ))}
                <Button className="print-list" onClick={() => window.print()}>
                  設置場所一覧を印刷
                </Button>
              </section>
            )}
            <details className="policy">
              <summary>参加データ・使い方について</summary>
              <p>
                サイト内の読み取りボタンから設置QRを読み取ります。生徒は学年・組・出席番号、一般客は参加IDをスタンプ履歴とともに保存します。進行状況・ランキングは管理者のみ閲覧できます。氏名・連絡先・位置情報は収集せず、カメラ映像・画像も送信しません。Cookieの有効期間と履歴の表示期間は30日です。サーバーの記録は開催後に主催者が削除します。同じ端末・ブラウザでご参加ください。Cookieの削除後は受付へご相談ください。
              </p>
            </details>
            <div className="scan-dock">
              <Button
                className="primary-action"
                disabled={failed || loading || !total}
                onClick={() => setScanning(true)}
              >
                <QrCode size={22} />
                QRを読み取る
              </Button>
              <small>立ち止まってから、読み取りましょう。</small>
            </div>
            <Scanner open={scanning} onClose={close} onScan={scan} />
          </>
        ) : null}
        <footer>
          <span>文化祭実行委員会</span>
          <span>歩きスマホはお控えください。</span>
        </footer>
      </div>
    </main>
  );
}
