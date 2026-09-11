'use client';
import { useI18n, LanguageSelect } from '@/components/language';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminStamps } from '@/components/admin-stamps';
import { AdminWiki } from '@/components/admin-wiki';
import { ThemeToggle } from '@/components/theme-toggle';
import QRCode from 'qrcode';
import {
  Users,
  GraduationCap,
  Trophy,
  MapPin,
  Settings,
  LogOut,
  RefreshCw,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  QrCode,
  Gift,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  defaultSettings,
  profileLabel,
  type Profile,
  type Spot,
  type FestivalSettings,
} from '@/lib/types';
import { dateTime as date } from '@/lib/utils';
type Row = Profile & {
  stampCount: number;
  ranking: number | null;
  createdAt: number;
  lastStamp: number | null;
};
type Stats = {
  total: number;
  students: number;
  guests: number;
  completed: number;
  redeemed: number;
  stamps: number;
  spotCount: number;
};
type ManagedSpot = Spot & { code: string };
type Audit = { action: string; target: string; createdAt: number };
async function api(path: string, data?: unknown) {
  const r = await fetch('/api/admin/' + path, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const result = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    const e = new Error(
      typeof result.error === 'string'
        ? result.error
        : '処理できませんでした。',
    ) as Error & { status: number };
    e.status = r.status;
    throw e;
  }
  return result;
}
export default function Admin() {
  const { t, locale } = useI18n();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('participants');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    students: 0,
    guests: 0,
    completed: 0,
    redeemed: 0,
    stamps: 0,
    spotCount: 0,
  });
  const [spots, setSpots] = useState<ManagedSpot[]>([]);
  const [config, setConfig] = useState<FestivalSettings>(defaultSettings);
  const [grades, setGrades] = useState('1,2,3');
  const [classes, setClasses] = useState('A,B,C,D,E');
  const [blockedWords, setBlockedWords] = useState('');
  const [staffPinSet, setStaffPinSet] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [logs, setLogs] = useState<Audit[]>([]);
  const [editingSpot, setEditingSpot] = useState<Partial<Spot> | null>(null);
  const [editingPerson, setEditingPerson] = useState<Row | null>(null);
  const [personStamps, setPersonStamps] = useState<
    { name: string; createdAt: number }[]
  >([]);
  const [action, setAction] = useState('edit');
  const [confirmation, setConfirmation] = useState('');
  const [purge, setPurge] = useState(false);
  const [poster, setPoster] = useState<{
    spot: ManagedSpot;
    image: string;
  } | null>(null);
  const failure = useCallback((e: unknown) => {
    if ((e as { status?: number }).status === 401) setAuthorized(false);
    setError(e instanceof Error ? e.message : '通信を確認してお試しください。');
  }, []);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api(
        `participants?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(search)}&page=${page}&sort=${tab === 'ranking' ? 'rank' : 'recent'}`,
      );
      setRows(r.rows as Row[]);
      setCount(r.count as number);
      setStats(r.stats as Stats);
      setAuthorized(true);
      if (tab === 'spots') {
        const d = await api('spots');
        setSpots(d.spots as ManagedSpot[]);
      }
      if (tab === 'settings') {
        const d = await api('settings');
        const c = d.settings as FestivalSettings;
        setConfig(c);
        setGrades(c.grades.join(','));
        setClasses(c.classes.join(','));
        setBlockedWords((c.nicknameBlockedWords ?? []).join('\n'));
        setStaffPinSet(d.staffPinSet === true);
        setLogs(d.logs as Audit[]);
      }
    } catch (e) {
      failure(e);
    } finally {
      setChecking(false);
      setBusy(false);
    }
  }, [kind, search, page, tab, failure]);
  useEffect(() => {
    // Load protected server data; no participant data is embedded in the page.
    // eslint-disable-next-line react/react-compiler
    void load();
  }, [load]);
  async function login(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('login', { password });
      setPassword('');
      await load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, data: unknown, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, data);
      setEditingSpot(null);
      setEditingPerson(null);
      setPurge(false);
      setConfirmation('');
      await load();
      setNotice(message);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function openPerson(row: Row) {
    setEditingPerson({ ...row });
    setAction(row.kind === 'student' ? 'edit' : 'reset');
    setConfirmation('');
    setPersonStamps([]);
    try {
      const d = await api('participants?id=' + row.id);
      setPersonStamps(d.stamps as { name: string; createdAt: number }[]);
    } catch (e) {
      failure(e);
    }
  }
  async function printQr(spot: ManagedSpot) {
    try {
      const image = await QRCode.toDataURL(spot.code, {
        width: 640,
        margin: 4,
        errorCorrectionLevel: 'M',
      });
      setPoster({ spot, image });
    } catch {
      setError('QRコードを生成できませんでした。');
    }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/export', {
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok)
        throw new Error(
          'CSVを出力できませんでした。再ログインしてお試しください。',
        );
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'festival-participants.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        'CSVを出力しました。生徒情報を含むため、管理者だけで保管してください。',
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  const chooseTab = (next: string) => {
    setTab(next);
    setPage(1);
    setNotice('');
  };
  if (checking)
    return (
      <main className="admin-shell">
        <p className="loading-state">
          {t('管理者の認証状態を確認しています…')}
        </p>
      </main>
    );
  if (!authorized)
    return (
      <main className="admin-login">
        <div className="admin-top-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
        <Link href="/" className="back-link">
          <ChevronLeft size={18} />
          {t('参加者サイトへ')}
        </Link>
        <div className="login-icon">
          <ShieldCheck size={34} />
        </div>
        <p className="eyebrow">FESTIVAL CONTROL</p>
        <h1>{t('管理者ログイン')}</h1>
        <p>{t('参加状況と文化祭の設定を管理します。')}</p>
        <form onSubmit={login} className="admin-form">
          <label>
            {t('管理者パスワード')}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <output className="form-error">{t(error)}</output>}
          <Button type="submit" className="primary-action" disabled={busy}>
            {busy ? t('確認中…') : t('ログイン')}
          </Button>
        </form>
        <small>{t('参加者情報は管理者だけが閲覧できます。')}</small>
      </main>
    );
  return (
    <main className="admin-shell">
      <div className="admin-top-actions">
        <ThemeToggle />
        <LanguageSelect />
      </div>
      <header className="admin-header">
        <div>
          <p className="eyebrow">FESTIVAL CONTROL</p>
          <h1>{t('文化祭 管理センター')}</h1>
        </div>
        <div>
          <Link href="/" className="back-link">
            {t('参加者サイト')}
            <ChevronRight size={16} />
          </Link>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await api('logout', {});
                setAuthorized(false);
                setRows([]);
                setError('');
              } catch (e) {
                failure(e);
              }
            }}
          >
            <LogOut size={16} />
            {t('ログアウト')}
          </Button>
        </div>
      </header>
      <div className="admin-stats">
        {[
          [Users, t('参加者'), stats.total],
          [GraduationCap, t('生徒'), stats.students],
          [Users, t('一般客'), stats.guests],
          [Trophy, t('コンプリート'), stats.completed],
          [Gift, t('報酬交換済み'), stats.redeemed],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Users;
          return (
            <article key={String(label)}>
              <I size={22} />
              <span>{String(label)}</span>
              <strong>
                {Number(value).toLocaleString()}
                <small>{t('人')}</small>
              </strong>
            </article>
          );
        })}
      </div>
      <nav className="admin-tabs" aria-label={t('管理メニュー')}>
        {[
          [Users, 'participants', t('参加者・進行状況')],
          [Trophy, 'ranking', t('ランキング')],
          [MapPin, 'spots', t('設置場所・QRコード')],
          [Settings, 'settings', t('設定・データ管理')],
          [BookOpen, 'wiki', t('運営マニュアル')],
        ].map(([Icon, id, label]) => {
          const I = Icon as typeof Users;
          return (
            <button
              key={String(id)}
              className={tab === id ? 'active' : ''}
              onClick={() => chooseTab(String(id))}
            >
              <I size={18} />
              {String(label)}
            </button>
          );
        })}
      </nav>
      {error && <output className="form-error">{t(error)}</output>}
      {notice && <output className="notice">{t(notice)}</output>}
      {(tab === 'participants' || tab === 'ranking') && (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <h2>
                {tab === 'ranking'
                  ? t('スタンプランキング')
                  : t('参加者・進行状況')}
              </h2>
              <p>
                {tab === 'ranking'
                  ? t('獲得数の多い順。同数なら、その数に早く到達した順。')
                  : t(
                      '参加者を選ぶと、押印履歴の確認や登録内容の管理ができます。',
                    )}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
              {t('更新')}
            </Button>
          </div>
          <form
            className="admin-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
              setPage(1);
            }}
          >
            <select
              aria-label={t('参加区分')}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('すべて')}</option>
              <option value="student">{t('生徒')}</option>
              <option value="guest">{t('一般客')}</option>
            </select>
            <input
              aria-label={t('参加者を検索')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('例：1年 A組 / #12')}
            />
            <Button type="submit" variant="outline">
              {t('検索')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void exportCsv()}
            >
              <Download size={16} />
              CSV
            </Button>
          </form>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {tab === 'ranking' && <th>{t('順位')}</th>}
                  <th>{t('参加者')}</th>
                  <th>{t('区分')}</th>
                  <th>{t('進行状況')}</th>
                  <th>{t('報酬交換')}</th>
                  <th>{t('最終押印')}</th>
                  <th>{t('管理')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {tab === 'ranking' && (
                      <td className="rank-value">{row.ranking ?? '—'}</td>
                    )}
                    <td>
                      <strong>{profileLabel(row, locale)}</strong>
                      <small>{row.nickname ?? t('ニックネーム未設定')}</small>
                      <small>
                        {t('登録')}
                        {date(row.createdAt, locale)}
                      </small>
                    </td>
                    <td>
                      <span
                        className={
                          row.kind === 'student' ? 'type-tag' : 'type-tag guest'
                        }
                      >
                        {row.kind === 'student' ? t('生徒') : t('一般客')}
                      </span>
                    </td>
                    <td>
                      <div className="row-progress">
                        <span
                          style={{
                            width:
                              (stats.spotCount
                                ? (row.stampCount / stats.spotCount) * 100
                                : 0) + '%',
                          }}
                        />
                      </div>
                      <small>
                        {row.stampCount} / {stats.spotCount}{' '}
                        {stats.spotCount > 0 &&
                        row.stampCount === stats.spotCount
                          ? t('コンプリート')
                          : ''}
                      </small>
                    </td>
                    <td>
                      {row.redeemedAt ? (
                        <>
                          <span className="redeem-tag done">
                            {t('交換済み')}
                          </span>
                          <small>{date(row.redeemedAt, locale)}</small>
                        </>
                      ) : (
                        <span className="redeem-tag">{t('未交換')}</span>
                      )}
                    </td>
                    <td>{date(row.lastStamp, locale)}</td>
                    <td>
                      <Button
                        variant="outline"
                        onClick={() => void openPerson(row)}
                      >
                        {t('管理')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="empty-state">
                {busy ? t('読み込み中…') : t('該当する参加者はいません。')}
              </p>
            )}
          </div>
          <div className="pagination">
            <span>
              {count}
              {t('人中')}
              {count ? (page - 1) * 50 + 1 : 0}〜{Math.min(page * 50, count)}
              {t('人')}
            </span>
            <div>
              <Button
                variant="outline"
                disabled={page === 1 || busy}
                onClick={() => setPage((p) => p - 1)}
                aria-label={t('前のページ')}
              >
                <ChevronLeft size={18} />
              </Button>
              <span>{page}</span>
              <Button
                variant="outline"
                disabled={page * 50 >= count || busy}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t('次のページ')}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        </section>
      )}
      {tab === 'spots' && (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <h2>{t('設置場所・QRコード管理')}</h2>
              <p>
                {t(
                  '公開中の場所がコンプリートの対象です。開催中の変更は達成状況に影響します。',
                )}
              </p>
            </div>
            <Button
              onClick={() =>
                setEditingSpot({
                  name: '',
                  location: '',
                  description: '',
                  sortOrder: spots.length,
                  active: 1,
                })
              }
            >
              <Plus size={18} />
              {t('場所を追加')}
            </Button>
          </div>
          {spots.length === 0 ? (
            <div className="empty-state">
              <p>
                {t(
                  '設置場所がありません。場所を追加するか、仮の6か所から準備できます。',
                )}
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void mutate(
                    'spots',
                    { action: 'seed' },
                    '仮の6か所を作成しました。実際の場所へ編集してください。',
                  )
                }
              >
                {t('仮の6か所を作成')}
              </Button>
            </div>
          ) : (
            <div className="admin-spots">
              {spots.map((s) => (
                <article key={s.id}>
                  <span className={s.active ? 'type-tag' : 'type-tag guest'}>
                    {s.active ? t('公開中') : t('非公開')}
                  </span>
                  <h3>{s.name}</h3>
                  <p>
                    <MapPin size={16} />
                    {s.location}
                  </p>
                  <small>
                    {s.description || t('案内なし')}
                    {t('· 表示順')}
                    {s.sortOrder}
                  </small>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setEditingSpot({ ...s })}
                    >
                      {t('編集')}
                    </Button>
                    <Button variant="outline" onClick={() => void printQr(s)}>
                      <QrCode size={16} />
                      {t('QRコード・印刷')}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'settings' && (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <h2>{t('開催設定とデータ管理')}</h2>
              <p>
                {t(
                  '学年・クラスは文字で追加できます。登録済みの生徒情報は変更されません。',
                )}
              </p>
            </div>
          </div>
          <form
            className="admin-form settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                'settings',
                {
                  settings: {
                    ...config,
                    nicknameBlockedWords: blockedWords
                      .split(/[,、\n]/)
                      .map((w) => w.trim())
                      .filter(Boolean),
                    grades: grades
                      .split(/[,、\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                    classes: classes
                      .split(/[,、\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                },
                '設定を保存しました。',
              );
            }}
          >
            <label>
              {t('文化祭名')}
              <input
                value={config.title}
                maxLength={60}
                onChange={(e) =>
                  setConfig({ ...config, title: e.target.value })
                }
                required
              />
            </label>
            <div className="field-pair">
              <label>
                {t('学年（カンマ区切り）')}
                <input
                  value={grades}
                  onChange={(e) => setGrades(e.target.value)}
                  placeholder={t('1,2,3,専攻科')}
                  required
                />
                <small>{t('例：1,2,3,専攻科')}</small>
              </label>
              <label>
                {t('組（カンマ区切り）')}
                <input
                  value={classes}
                  onChange={(e) => setClasses(e.target.value)}
                  placeholder="A,B,C,D,E"
                  required
                />
                <small>{t('例：A,B,C,D,E,F')}</small>
              </label>
            </div>
            <label>
              {t('出席番号の上限')}
              <input
                type="number"
                min={1}
                max={999}
                value={config.maxNumber}
                onChange={(e) =>
                  setConfig({ ...config, maxNumber: Number(e.target.value) })
                }
                required
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={config.registrationOpen}
                onChange={(e) =>
                  setConfig({ ...config, registrationOpen: e.target.checked })
                }
              />
              {t('新規参加登録を受け付ける')}
            </label>
            <label>
              {t('ニックネームの追加禁止語（1行に1つ）')}
              <textarea
                value={blockedWords}
                onChange={(e) => setBlockedWords(e.target.value)}
                rows={4}
                placeholder={t('学校独自の禁止語を入力')}
              />
              <small>
                {t(
                  '標準の禁止語に加えて判定します。100件まで。登録済みの名前を自動変更するものではありません。',
                )}
              </small>
            </label>
            <Button type="submit" disabled={busy}>
              {t('設定を保存')}
            </Button>
          </form>
          <form
            className="admin-form staff-pin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                'settings',
                { action: 'staffPin', pin: staffPin },
                '係員用暗証番号を保存しました。',
              );
              setStaffPin('');
            }}
          >
            <h3>{t('報酬受け取り用の係員暗証番号')}</h3>
            <p
              className={
                staffPinSet ? 'staff-pin-state set' : 'staff-pin-state unset'
              }
            >
              {staffPinSet
                ? t('設定済みです。参加者の画面で係員が入力します。')
                : t('未設定です。設定するまで参加者は報酬を受け取れません。')}
            </p>
            <label>
              {t('新しい暗証番号（4〜8桁の数字）')}
              <input
                value={staffPin}
                onChange={(e) =>
                  setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                inputMode="numeric"
                type="password"
                autoComplete="new-password"
                placeholder="••••"
              />
              <small>
                {t(
                  '係員だけに共有してください。参加者の端末で入力するため、他の場所で使っていない番号にしてください。',
                )}
              </small>
            </label>
            <div className="staff-pin-actions">
              <Button type="submit" disabled={busy || staffPin.length < 4}>
                {t('暗証番号を保存')}
              </Button>
              {staffPinSet && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t(
                          '暗証番号を削除すると、報酬の受け取りができなくなります。よろしいですか？',
                        ),
                      )
                    )
                      return;
                    void mutate(
                      'settings',
                      { action: 'staffPin', clear: true },
                      '係員用暗証番号を削除しました。',
                    );
                  }}
                >
                  {t('暗証番号を削除')}
                </Button>
              )}
            </div>
          </form>
          <div className="data-actions">
            <div>
              <h3>{t('参加データを保存')}</h3>
              <p>{t('生徒・一般客の進行状況と順位をCSVに出力します。')}</p>
              <Button
                variant="outline"
                onClick={() => void exportCsv()}
                disabled={busy}
              >
                <Download size={16} />
                {t('CSVをダウンロード')}
              </Button>
            </div>
            <div className="danger-zone">
              <h3>{t('開催後のデータ削除')}</h3>
              <p>
                {t(
                  '学年・組・出席番号を含む全参加情報とスタンプを削除します。設置場所と設定は残ります。元に戻せません。',
                )}
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setPurge(true);
                  setConfirmation('');
                }}
              >
                {t('全参加データを削除…')}
              </Button>
            </div>
          </div>
          <details className="audit-details">
            <summary>{t('管理操作の履歴（最新30件）')}</summary>
            <ul>
              {logs.map((log, i) => (
                <li key={i}>
                  {date(log.createdAt, locale)} · {log.action}
                  {t('· 対象')}
                  {log.target}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      {tab === 'wiki' && <AdminWiki onDenied={failure} />}
      <Dialog
        open={editingSpot !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSpot(null);
        }}
      >
        <DialogContent className="admin-dialog" showCloseButton={false}>
          <DialogTitle>
            {editingSpot?.id ? t('設置場所を編集') : t('設置場所を追加')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'QRコードは場所ごとに発行されます。非公開にすると押印対象から外れます。',
            )}
          </DialogDescription>
          {editingSpot && (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate('spots', editingSpot, '設置場所を保存しました。');
              }}
            >
              <label>
                {t('名称')}
                <input
                  value={editingSpot.name}
                  maxLength={60}
                  onChange={(e) =>
                    setEditingSpot({ ...editingSpot, name: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t('場所・階・教室')}
                <input
                  value={editingSpot.location}
                  maxLength={80}
                  onChange={(e) =>
                    setEditingSpot({ ...editingSpot, location: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t('設置位置の案内')}
                <textarea
                  value={editingSpot.description}
                  maxLength={160}
                  onChange={(e) =>
                    setEditingSpot({
                      ...editingSpot,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                {t('表示順')}
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={editingSpot.sortOrder}
                  onChange={(e) =>
                    setEditingSpot({
                      ...editingSpot,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={editingSpot.active === 1}
                  onChange={(e) =>
                    setEditingSpot({
                      ...editingSpot,
                      active: e.target.checked ? 1 : 0,
                    })
                  }
                />
                {t('公開して押印対象にする')}
              </label>
              {error && <output className="form-error">{t(error)}</output>}
              <Button type="submit" disabled={busy}>
                {t('保存')}
              </Button>
            </form>
          )}
          <DialogClose render={<Button variant="outline" />}>
            {t('閉じる')}
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingPerson !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPerson(null);
        }}
      >
        <DialogContent className="admin-dialog" showCloseButton={false}>
          <DialogTitle>
            {editingPerson
              ? profileLabel(editingPerson, locale)
              : t('参加者管理')}
          </DialogTitle>
          <DialogDescription>
            {t('本人確認をしたうえで登録内容を管理してください。')}
          </DialogDescription>
          {editingPerson && (
            <>
              <AdminStamps
                key={editingPerson.id}
                id={editingPerson.id}
                onUpdated={async () => {
                  const d = await api('participants?id=' + editingPerson.id);
                  setPersonStamps(
                    d.stamps as { name: string; createdAt: number }[],
                  );
                  await load();
                }}
              />
              <ul className="stamp-history">
                {personStamps.length ? (
                  personStamps.map((s, i) => (
                    <li key={i}>
                      <span>{s.name}</span>
                      <small>{date(s.createdAt, locale)}</small>
                    </li>
                  ))
                ) : (
                  <li>{t('押印履歴はありません。')}</li>
                )}
              </ul>
              <div className="redeem-panel">
                <div>
                  <strong>{t('報酬の交換')}</strong>
                  {editingPerson.redeemedAt ? (
                    <small>
                      {t('交換済み')} · {date(editingPerson.redeemedAt, locale)}
                    </small>
                  ) : (
                    <small>{t('まだ交換していません。')}</small>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const redeemed = !editingPerson.redeemedAt;
                    if (
                      !redeemed &&
                      !window.confirm(
                        t('交換の記録を取り消します。よろしいですか？'),
                      )
                    )
                      return;
                    // mutate() closes this dialog and reloads the table.
                    void mutate(
                      'participants',
                      { id: editingPerson.id, action: 'redeem', redeemed },
                      redeemed
                        ? '報酬を交換済みにしました。'
                        : '交換の記録を取り消しました。',
                    );
                  }}
                >
                  {editingPerson.redeemedAt
                    ? t('交換を取り消す')
                    : t('交換済みにする')}
                </Button>
              </div>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    'participants',
                    { ...editingPerson, action, confirm: confirmation },
                    '参加者情報を更新しました。',
                  );
                }}
              >
                <label>
                  {t('操作')}
                  <select
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setConfirmation('');
                    }}
                  >
                    {editingPerson.kind === 'student' && (
                      <option value="edit">{t('登録内容を修正')}</option>
                    )}
                    <option value="reset">{t('スタンプをリセット')}</option>
                    <option value="delete">{t('参加者と履歴を削除')}</option>
                  </select>
                </label>
                {action === 'edit' ? (
                  <>
                    <div className="field-pair">
                      <label>
                        {t('学年')}
                        <input
                          value={editingPerson.grade ?? ''}
                          onChange={(e) =>
                            setEditingPerson({
                              ...editingPerson,
                              grade: e.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <label>
                        {t('組')}
                        <input
                          value={editingPerson.className ?? ''}
                          onChange={(e) =>
                            setEditingPerson({
                              ...editingPerson,
                              className: e.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <label>
                        {t('出席番号')}
                        <input
                          type="number"
                          min={1}
                          value={editingPerson.number ?? ''}
                          onChange={(e) =>
                            setEditingPerson({
                              ...editingPerson,
                              number: Number(e.target.value),
                            })
                          }
                          required
                        />
                      </label>
                    </div>
                    <p className="form-hint">
                      {t(
                        '開催設定で登録されている学年・組を入力してください。',
                      )}
                    </p>
                  </>
                ) : (
                  <label>
                    {t('取り消せません。「')}
                    {action === 'reset' ? 'スタンプをリセット' : '参加者を削除'}
                    {t('」と入力')}
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      required
                    />
                  </label>
                )}
                {error && <output className="form-error">{t(error)}</output>}
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    (action !== 'edit' &&
                      confirmation !==
                        (action === 'reset'
                          ? 'スタンプをリセット'
                          : '参加者を削除'))
                  }
                  variant={action === 'edit' ? 'default' : 'destructive'}
                >
                  {t('実行する')}
                </Button>
              </form>
            </>
          )}
          <DialogClose render={<Button variant="outline" />}>
            {t('閉じる')}
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={purge} onOpenChange={setPurge}>
        <DialogContent className="admin-dialog" showCloseButton={false}>
          <DialogTitle>{t('全参加データの削除')}</DialogTitle>
          <DialogDescription>
            {t(
              '全員の登録情報とスタンプ履歴を削除します。必要なCSVを先に保存してください。',
            )}
          </DialogDescription>
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                'settings',
                { action: 'purge', confirm: confirmation },
                '全参加データを削除しました。',
              );
            }}
          >
            <label>
              {t('「全参加データを削除」と入力')}
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || confirmation !== '全参加データを削除'}
            >
              {t('削除する')}
            </Button>
          </form>
          <DialogClose render={<Button variant="outline" />}>
            {t('キャンセル')}
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog
        open={poster !== null}
        onOpenChange={(open) => {
          if (!open) setPoster(null);
        }}
      >
        <DialogContent
          className="admin-dialog poster-dialog"
          showCloseButton={false}
        >
          <DialogTitle>{t('設置用QRコード')}</DialogTitle>
          <DialogDescription>
            {t(
              '参加者サイト内のカメラで読み取ります。公開前に実機でお試しください。',
            )}
          </DialogDescription>
          {poster && (
            <div className="qr-poster">
              <p>{t('文化祭 STAMP RALLY')}</p>
              <h2>{poster.spot.name}</h2>
              <h3>{poster.spot.location}</h3>
              {/* QRCode output is generated locally and is not an external image. */}
              {/* eslint-disable-next-line next/no-img-element */}
              <img
                src={poster.image}
                alt={poster.spot.name + t('の設置用QRコード')}
                width={320}
                height={320}
              />
              <strong>
                {t('サイト内の「QRコードを読み取る」から')}
                <br />
                {t('このQRコードを読み取ってください。')}
              </strong>
              <p>
                {poster.spot.active ? '' : t('この場所は現在、非公開です。')}
              </p>
            </div>
          )}
          <Button onClick={() => window.print()}>
            {t('このQRコードを印刷')}
          </Button>
          <DialogClose render={<Button variant="outline" />}>
            {t('閉じる')}
          </DialogClose>
        </DialogContent>
      </Dialog>
      <footer>
        <span>
          {t('管理者専用 · 参加者情報は取り扱いに注意してください。')}
        </span>
        <span>
          {t('表示中の対象スポット：')}
          {stats.spotCount}
          {t('か所')}
        </span>
      </footer>
    </main>
  );
}
