'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Scanner } from '@/components/scanner';
import {
  QrCode,
  MapPin,
  ArrowUpRight,
  Stamp,
  Flag,
  Music,
  FlaskConical,
  Palette,
  Coffee,
  Theater,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spots } from '@/lib/event';
const icons = [Flag, Palette, FlaskConical, Coffee, Music, Theater];
export default function Home() {
  const [tab, setTab] = useState('book');
  const [stamps, setStamps] = useState<{ spotId: string; createdAt: number }[]>(
    [],
  );
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const total = spots.length;
  const count = stamps.length;
  const has = (id: string) => stamps.some((s) => s.spotId === id);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/passport', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const data = (await response.json()) as {
        error: string;
        stamps: { spotId: string; createdAt: number }[];
        spotId: string;
        duplicate: boolean;
      };
      if (!response.ok) throw new Error(data.error);
      setStamps(data.stamps);
      setReady(true);
      setFailed(false);
      setNotice('');
    } catch (e) {
      setFailed(true);
      setReady(false);
      setNotice(
        e instanceof Error && e.name !== 'TimeoutError'
          ? e.message
          : '通信が不安定です。もう一度読み込んでください。',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Initial fetch synchronizes the passport with its server-owned record.
    // eslint-disable-next-line react/react-compiler
    void reload();
  }, [reload]);
  const close = useCallback(() => setScanning(false), []);
  const scan = useCallback(async (code: string) => {
    const response = await fetch('/api/stamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new Error('通信を確認して、同じQRで再試行してください。');
    });
    const data = (await response.json()) as {
      error: string;
      stamps: { spotId: string; createdAt: number }[];
      spotId: string;
      duplicate: boolean;
    };
    if (!response.ok) throw new Error(data.error);
    setStamps((current) =>
      current.some((s) => s.spotId === data.spotId)
        ? current
        : [
            ...current,
            { spotId: data.spotId, createdAt: Math.floor(Date.now() / 1000) },
          ],
    );
    setFailed(false);
    setNotice(
      data.duplicate
        ? 'このスタンプは獲得済みです。'
        : (spots.find((s) => s.id === data.spotId)?.name ?? '') +
            ' のスタンプを獲得しました！',
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
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'show_stamp_locations',
            title: '設置場所一覧を開く',
            description:
              '設置場所一覧を表示し、場所と獲得状況を返します。押印は行いません。',
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
                Array.isArray(input) || Object.keys(input).length
              )
                throw new Error('引数は空のオブジェクトを指定してください。');
              setTab('places');
              return {
                spots: spots.map((s) => ({
                  ...s,
                  collected: stamps.some((x) => x.spotId === s.id),
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [stamps]);
  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Stamp size={22} />
          </span>
          文化祭 <span className="brand-light">STAMP RALLY</span>
        </Link>
        <span className="sample-badge">開催準備中・サンプル</span>
      </header>
      <div className="page">
        <div className="intro">
          <div>
            <p className="eyebrow">CAMPUS EXPLORER / 文化祭</p>
            <h1>
              校内をめぐって、
              <br />
              思い出を集めよう。
            </h1>
            <p className="lead">
              6つのスポットでQRを読み取り、スタンプを集めよう。
            </p>
          </div>
          <div className="edition">
            <span>YOUR FESTIVAL</span>
            <strong>
              PASS<span> / 06</span>
            </strong>
            <small>学校のあちこちに、新しい発見。</small>
          </div>
        </div>
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
        <Button
          className="mobile-scan"
          disabled={!ready || loading}
          onClick={() => setScanning(true)}
        >
          <QrCode size={20} />
          {loading ? 'スタンプ帳を読み込み中…' : 'QRを読み取る'}
        </Button>
        <div className="workspace">
          <section className="passport">
            <div className="tabs">
              <button
                className={tab === 'book' ? 'active' : ''}
                onClick={() => setTab('book')}
              >
                <Stamp size={18} />
                スタンプ帳
              </button>
              <button
                className={tab === 'places' ? 'active' : ''}
                onClick={() => setTab('places')}
              >
                <MapPin size={18} />
                設置場所一覧
              </button>
            </div>
            <div className="sheet">
              <div className="sheet-heading">
                <div>
                  <p className="eyebrow">MY COLLECTION</p>
                  <h2>
                    {tab === 'book'
                      ? 'わたしのスタンプ帳'
                      : 'スタンプを探しに行こう'}
                  </h2>
                </div>
                <span className="count">
                  {ready ? count : '—'} <small>/ {total}</small>
                </span>
              </div>
              <div className="progress">
                <span style={{ width: (count / total) * 100 + '%' }} />
              </div>
              <p className="progress-caption">
                {loading
                  ? 'スタンプ帳を読み込み中…'
                  : !ready
                    ? 'スタンプ帳を読み込めませんでした'
                    : count === total
                      ? '全スポット達成！ コンプリートおめでとう！'
                      : `コンプリートまで、あと${total - count}か所`}
              </p>
              {tab === 'book' ? (
                <div className="stamp-grid">
                  {spots.map((spot, i) => {
                    const Icon = icons[i];
                    return (
                      <article
                        className={
                          has(spot.id) ? 'stamp-card collected' : 'stamp-card'
                        }
                        key={spot.id}
                      >
                        <span className="spot-number">0{i + 1}</span>
                        <div className="stamp-circle">
                          <Icon size={34} strokeWidth={1.4} />
                        </div>
                        <h3>{spot.name}</h3>
                        <p>{spot.location}</p>
                        <span className="uncollected">
                          {has(spot.id)
                            ? '獲得済み'
                            : ready
                              ? '未獲得'
                              : '確認中'}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="places">
                  {spots.map((spot, i) => (
                    <article key={spot.id}>
                      <span className="list-number">0{i + 1}</span>
                      <div>
                        <h3>{spot.name}</h3>
                        <p>
                          <MapPin size={14} />
                          {spot.location} · {spot.description}
                        </p>
                      </div>
                      {has(spot.id) && (
                        <Check
                          className="list-status"
                          aria-label="獲得済み"
                          size={20}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
              {tab === 'places' && (
                <Button className="print-list" onClick={() => window.print()}>
                  設置場所一覧を印刷
                </Button>
              )}
              <div
                className={count === total ? 'completion done' : 'completion'}
              >
                <Flag size={23} />
                <div>
                  <strong>
                    {count === total
                      ? 'コンプリート、おめでとう！'
                      : 'すべて集めて、コンプリート！'}
                  </strong>
                  <p>校内の6か所を巡って文化祭を楽しもう。</p>
                </div>
              </div>
            </div>
          </section>
          <aside>
            <section className="scan-card">
              <span className="scan-label">NEXT STAMP</span>
              <div className="qr-frame">
                <QrCode size={76} strokeWidth={1.5} />
              </div>
              <h2>見つけたら、読み取ろう。</h2>
              <p>
                各スポットにあるQRを
                <br />
                カメラで読み取ってスタンプを獲得。
              </p>
              <Button
                className="scan-button"
                disabled={!ready || loading}
                onClick={() => setScanning(true)}
              >
                <QrCode size={20} />
                QRを読み取る
                <ArrowUpRight size={20} />
              </Button>
              <small>カメラへのアクセスを許可してください</small>
            </section>
            <section className="guide">
              <h3>参加はかんたん、3ステップ</h3>
              {[
                '設置場所一覧でスポットを探す',
                'その場所でQRを読み取る',
                '6つ集めてコンプリート！',
              ].map((s, i) => (
                <p key={s}>
                  <span>{i + 1}</span>
                  {s}
                </p>
              ))}
            </section>
            <div className="privacy-note">
              <Check size={18} />
              <p>
                氏名・メールアドレスの登録は不要です。
                <br />
                同じ端末・ブラウザでご参加ください。
              </p>
            </div>
          </aside>
        </div>
        <details className="policy">
          <summary>参加データについて</summary>
          <p>
            氏名・メールアドレス・位置情報は収集しません。匿名の識別子と押印した場所・日時をサーバーに保存します。このブラウザのCookieを削除すると履歴を取り戻せません。別の端末やブラウザへの引き継ぎはできません。履歴の表示期間とCookieの有効期間は30日です。サーバーの記録は開催後に主催者が削除します。QR画像とカメラ映像は端末内で処理し、サーバーへ送信しません。通信時には配信基盤でIPアドレス等が処理される場合があります。
          </p>
        </details>
        <Scanner open={scanning} onClose={close} onScan={scan} />
        <footer>
          <span>文化祭実行委員会</span>
          <span>歩きながらのスマートフォン操作はお控えください。</span>
        </footer>
      </div>
    </main>
  );
}

