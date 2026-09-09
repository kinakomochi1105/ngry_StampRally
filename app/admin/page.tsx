'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
const date = (n: number | null) =>
  n
    ? new Date(n * 1000).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';
export default function Admin() {
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
    stamps: 0,
    spotCount: 0,
  });
  const [spots, setSpots] = useState<ManagedSpot[]>([]);
  const [config, setConfig] = useState<FestivalSettings>(defaultSettings);
  const [grades, setGrades] = useState('1,2,3');
  const [classes, setClasses] = useState('A,B,C,D,E');
  const [blockedWords, setBlockedWords] = useState('');
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
      setError('QRを生成できませんでした。');
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
        <p className="loading-state">管理者の認証状態を確認しています…</p>
      </main>
    );
  if (!authorized)
    return (
      <main className="admin-login">
        <Link href="/" className="back-link">
          <ChevronLeft size={18} />
          参加者サイトへ
        </Link>
        <div className="login-icon">
          <ShieldCheck size={34} />
        </div>
        <p className="eyebrow">FESTIVAL CONTROL</p>
        <h1>管理者ログイン</h1>
        <p>参加状況と文化祭の設定を管理します。</p>
        <form onSubmit={login} className="admin-form">
          <label>
            管理者パスワード
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <output className="form-error">{error}</output>}
          <Button type="submit" className="primary-action" disabled={busy}>
            {busy ? '確認中…' : 'ログイン'}
          </Button>
        </form>
        <small>参加者情報は管理者だけが閲覧できます。</small>
      </main>
    );
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">FESTIVAL CONTROL</p>
          <h1>文化祭 管理センター</h1>
        </div>
        <div>
          <Link href="/" className="back-link">
            参加者サイト
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
            ログアウト
          </Button>
        </div>
      </header>
      <div className="admin-stats">
        {[
          [Users, '参加者', stats.total],
          [GraduationCap, '生徒', stats.students],
          [Users, '一般客', stats.guests],
          [Trophy, 'コンプリート', stats.completed],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Users;
          return (
            <article key={String(label)}>
              <I size={22} />
              <span>{String(label)}</span>
              <strong>
                {Number(value).toLocaleString()}
                <small>人</small>
              </strong>
            </article>
          );
        })}
      </div>
      <nav className="admin-tabs" aria-label="管理メニュー">
        {[
          [Users, 'participants', '参加者・進行状況'],
          [Trophy, 'ranking', 'ランキング'],
          [MapPin, 'spots', '設置場所・QR'],
          [Settings, 'settings', '設定・データ管理'],
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
      {error && <output className="form-error">{error}</output>}
      {notice && <output className="notice">{notice}</output>}
      {(tab === 'participants' || tab === 'ranking') && (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <h2>
                {tab === 'ranking' ? 'スタンプランキング' : '参加者・進行状況'}
              </h2>
              <p>
                {tab === 'ranking'
                  ? '獲得数の多い順。同数なら、その数に早く到達した順。'
                  : '参加者を選ぶと、押印履歴の確認や登録内容の管理ができます。'}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
              更新
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
              aria-label="参加区分"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">すべて</option>
              <option value="student">生徒</option>
              <option value="guest">一般客</option>
            </select>
            <input
              aria-label="参加者を検索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例：1年 A組 / #12"
            />
            <Button type="submit" variant="outline">
              検索
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
                  {tab === 'ranking' && <th>順位</th>}
                  <th>参加者</th>
                  <th>区分</th>
                  <th>進行状況</th>
                  <th>最終押印</th>
                  <th>管理</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {tab === 'ranking' && (
                      <td className="rank-value">{row.ranking ?? '—'}</td>
                    )}
                    <td>
                      <strong>{profileLabel(row)}</strong>
                      <small>{row.nickname ?? 'ニックネーム未設定'}</small>
                      <small>登録 {date(row.createdAt)}</small>
                    </td>
                    <td>
                      <span
                        className={
                          row.kind === 'student' ? 'type-tag' : 'type-tag guest'
                        }
                      >
                        {row.kind === 'student' ? '生徒' : '一般客'}
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
                          ? 'コンプリート'
                          : ''}
                      </small>
                    </td>
                    <td>{date(row.lastStamp)}</td>
                    <td>
                      <Button
                        variant="outline"
                        onClick={() => void openPerson(row)}
                      >
                        管理
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="empty-state">
                {busy ? '読み込み中…' : '該当する参加者はいません。'}
              </p>
            )}
          </div>
          <div className="pagination">
            <span>
              {count}人中 {count ? (page - 1) * 50 + 1 : 0}〜
              {Math.min(page * 50, count)}人
            </span>
            <div>
              <Button
                variant="outline"
                disabled={page === 1 || busy}
                onClick={() => setPage((p) => p - 1)}
                aria-label="前のページ"
              >
                <ChevronLeft size={18} />
              </Button>
              <span>{page}</span>
              <Button
                variant="outline"
                disabled={page * 50 >= count || busy}
                onClick={() => setPage((p) => p + 1)}
                aria-label="次のページ"
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
              <h2>設置場所・QR管理</h2>
              <p>
                公開中の場所がコンプリートの対象です。開催中の変更は達成状況に影響します。
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
              場所を追加
            </Button>
          </div>
          {spots.length === 0 ? (
            <div className="empty-state">
              <p>
                設置場所がありません。場所を追加するか、仮の6か所から準備できます。
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
                仮の6か所を作成
              </Button>
            </div>
          ) : (
            <div className="admin-spots">
              {spots.map((s) => (
                <article key={s.id}>
                  <span className={s.active ? 'type-tag' : 'type-tag guest'}>
                    {s.active ? '公開中' : '非公開'}
                  </span>
                  <h3>{s.name}</h3>
                  <p>
                    <MapPin size={16} />
                    {s.location}
                  </p>
                  <small>
                    {s.description || '案内なし'} · 表示順 {s.sortOrder}
                  </small>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setEditingSpot({ ...s })}
                    >
                      編集
                    </Button>
                    <Button variant="outline" onClick={() => void printQr(s)}>
                      <QrCode size={16} />
                      QR・印刷
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
              <h2>開催設定とデータ管理</h2>
              <p>
                学年・クラスは文字で追加できます。登録済みの生徒情報は変更されません。
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
              文化祭名
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
                学年（カンマ区切り）
                <input
                  value={grades}
                  onChange={(e) => setGrades(e.target.value)}
                  placeholder="1,2,3,専攻科"
                  required
                />
                <small>例：1,2,3,専攻科</small>
              </label>
              <label>
                組（カンマ区切り）
                <input
                  value={classes}
                  onChange={(e) => setClasses(e.target.value)}
                  placeholder="A,B,C,D,E"
                  required
                />
                <small>例：A,B,C,D,E,F</small>
              </label>
            </div>
            <label>
              出席番号の上限
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
              新規参加登録を受け付ける
            </label>
            <label>
              ニックネームの追加禁止語（1行に1つ）
              <textarea
                value={blockedWords}
                onChange={(e) => setBlockedWords(e.target.value)}
                rows={4}
                placeholder="学校独自の禁止語を入力"
              />
              <small>
                標準の禁止語に加えて判定します。100件まで。登録済みの名前を自動変更するものではありません。
              </small>
            </label>
            <Button type="submit" disabled={busy}>
              設定を保存
            </Button>
          </form>
          <div className="data-actions">
            <div>
              <h3>参加データを保存</h3>
              <p>生徒・一般客の進行状況と順位をCSVに出力します。</p>
              <Button
                variant="outline"
                onClick={() => void exportCsv()}
                disabled={busy}
              >
                <Download size={16} />
                CSVをダウンロード
              </Button>
            </div>
            <div className="danger-zone">
              <h3>開催後のデータ削除</h3>
              <p>
                学年・組・出席番号を含む全参加情報とスタンプを削除します。設置場所と設定は残ります。元に戻せません。
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setPurge(true);
                  setConfirmation('');
                }}
              >
                全参加データを削除…
              </Button>
            </div>
          </div>
          <details className="audit-details">
            <summary>管理操作の履歴（最新30件）</summary>
            <ul>
              {logs.map((log, i) => (
                <li key={i}>
                  {date(log.createdAt)} · {log.action} · 対象 {log.target}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      <Dialog
        open={editingSpot !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSpot(null);
        }}
      >
        <DialogContent className="admin-dialog" showCloseButton={false}>
          <DialogTitle>
            {editingSpot?.id ? '設置場所を編集' : '設置場所を追加'}
          </DialogTitle>
          <DialogDescription>
            QRは場所ごとに発行されます。非公開にすると押印対象から外れます。
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
                名称
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
                場所・階・教室
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
                設置位置の案内
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
                表示順
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
                公開して押印対象にする
              </label>
              {error && <output className="form-error">{error}</output>}
              <Button type="submit" disabled={busy}>
                保存
              </Button>
            </form>
          )}
          <DialogClose render={<Button variant="outline" />}>
            閉じる
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
            {editingPerson ? profileLabel(editingPerson) : '参加者管理'}
          </DialogTitle>
          <DialogDescription>
            本人確認をしたうえで登録内容を管理してください。
          </DialogDescription>
          {editingPerson && (
            <>
              <ul className="stamp-history">
                {personStamps.length ? (
                  personStamps.map((s, i) => (
                    <li key={i}>
                      <span>{s.name}</span>
                      <small>{date(s.createdAt)}</small>
                    </li>
                  ))
                ) : (
                  <li>押印履歴はありません。</li>
                )}
              </ul>
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
                  操作
                  <select
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setConfirmation('');
                    }}
                  >
                    {editingPerson.kind === 'student' && (
                      <option value="edit">登録内容を修正</option>
                    )}
                    <option value="reset">スタンプをリセット</option>
                    <option value="delete">参加者と履歴を削除</option>
                  </select>
                </label>
                {action === 'edit' ? (
                  <>
                    <div className="field-pair">
                      <label>
                        学年
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
                        組
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
                        出席番号
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
                      開催設定で登録されている学年・組を入力してください。
                    </p>
                  </>
                ) : (
                  <label>
                    取り消せません。「
                    {action === 'reset' ? 'スタンプをリセット' : '参加者を削除'}
                    」と入力
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      required
                    />
                  </label>
                )}
                {error && <output className="form-error">{error}</output>}
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
                  実行する
                </Button>
              </form>
            </>
          )}
          <DialogClose render={<Button variant="outline" />}>
            閉じる
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={purge} onOpenChange={setPurge}>
        <DialogContent className="admin-dialog" showCloseButton={false}>
          <DialogTitle>全参加データの削除</DialogTitle>
          <DialogDescription>
            全員の登録情報とスタンプ履歴を削除します。必要なCSVを先に保存してください。
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
              「全参加データを削除」と入力
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
              削除する
            </Button>
          </form>
          <DialogClose render={<Button variant="outline" />}>
            キャンセル
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
          <DialogTitle>設置用QR</DialogTitle>
          <DialogDescription>
            参加者サイト内のカメラで読み取ります。公開前に実機でお試しください。
          </DialogDescription>
          {poster && (
            <div className="qr-poster">
              <p>文化祭 STAMP RALLY</p>
              <h2>{poster.spot.name}</h2>
              <h3>{poster.spot.location}</h3>
              {/* QRCode output is generated locally and is not an external image. */}
              {/* eslint-disable-next-line next/no-img-element */}
              <img
                src={poster.image}
                alt={poster.spot.name + ' の設置用QR'}
                width={320}
                height={320}
              />
              <strong>
                サイト内の「QRを読み取る」から
                <br />
                このQRを読み取ってください。
              </strong>
              <p>{poster.spot.active ? '' : 'この場所は現在、非公開です。'}</p>
            </div>
          )}
          <Button onClick={() => window.print()}>このQRを印刷</Button>
          <DialogClose render={<Button variant="outline" />}>
            閉じる
          </DialogClose>
        </DialogContent>
      </Dialog>
      <footer>
        <span>管理者専用 · 参加者情報は取り扱いに注意してください。</span>
        <span>表示中の対象スポット：{stats.spotCount}か所</span>
      </footer>
    </main>
  );
}
