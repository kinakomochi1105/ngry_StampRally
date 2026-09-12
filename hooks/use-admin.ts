'use client';
import { useCallback, useEffect, useState } from 'react';
import { api as request, errorMessage, isUnauthorized } from '@/lib/client';
import {
  defaultSettings,
  type FestivalSettings,
  type Profile,
  type Spot,
  type VenueMap,
} from '@/lib/types';

export type Row = Profile & {
  stampCount: number;
  ranking: number | null;
  createdAt: number;
  lastStamp: number | null;
};

export type Stats = {
  total: number;
  students: number;
  guests: number;
  completed: number;
  redeemed: number;
  stamps: number;
  spotCount: number;
};

export type ManagedSpot = Spot & { code: string };
export type Audit = { action: string; target: string; createdAt: number };
export type AdminTab =
  | 'participants'
  | 'ranking'
  | 'spots'
  | 'maps'
  | 'settings';

export const pageSize = 50;

const noStats: Stats = {
  total: 0,
  students: 0,
  guests: 0,
  completed: 0,
  redeemed: 0,
  stamps: 0,
  spotCount: 0,
};

/** Every organiser request goes through here, so failures look the same. */
export const api = (path: string, data?: unknown) =>
  request('/api/admin/' + path, {
    data,
    fallback: '処理できませんでした。',
    timeout: 20000,
  });

/**
 * The organiser console's session and data. The screens below it only render
 * and call back in: nothing fetches on its own except the per-participant
 * stamp editor, which belongs to one open dialog.
 */
export function useAdmin() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [tab, setTab] = useState<AdminTab>('participants');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<Stats>(noStats);
  const [spots, setSpots] = useState<ManagedSpot[]>([]);
  const [maps, setMaps] = useState<VenueMap[]>([]);
  const [settings, setSettings] = useState<FestivalSettings>(defaultSettings);
  const [staffPinSet, setStaffPinSet] = useState(false);
  const [sitePasswordSet, setSitePasswordSet] = useState(false);
  const [logs, setLogs] = useState<Audit[]>([]);
  // Bumped whenever settings arrive, so the settings form remounts with the
  // values from the server instead of syncing field by field.
  const [settingsVersion, setSettingsVersion] = useState(0);

  const failure = useCallback((problem: unknown) => {
    if (isUnauthorized(problem)) setAuthorized(false);
    setError(errorMessage(problem, '通信を確認してお試しください。'));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const list = await api(
        `participants?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(search)}&page=${page}&sort=${tab === 'ranking' ? 'rank' : 'recent'}`,
      );
      setRows(list.rows as Row[]);
      setCount(list.count as number);
      setStats(list.stats as Stats);
      setAuthorized(true);
      if (tab === 'spots') {
        const result = await api('spots');
        setSpots(result.spots as ManagedSpot[]);
      }
      if (tab === 'maps') {
        // The locations come back with the maps: an area is linked by
        // choosing one of them, so the editor needs both.
        const result = await api('maps');
        setMaps(result.maps as VenueMap[]);
        setSpots(
          (result.spots as Spot[]).map((spot) => ({ ...spot, code: '' })),
        );
      }
      if (tab === 'settings') {
        const result = await api('settings');
        setSettings(result.settings as FestivalSettings);
        setStaffPinSet(result.staffPinSet === true);
        setSitePasswordSet(result.sitePasswordSet === true);
        setLogs(result.logs as Audit[]);
        setSettingsVersion((v) => v + 1);
      }
    } catch (problem) {
      failure(problem);
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

  useEffect(() => {
    // The list follows the box while it is typed in, so nothing has to be
    // submitted. The pause keeps one request per word rather than per key.
    const term = query.trim();
    const timer = setTimeout(() => {
      setSearch((current) => {
        if (current !== term) setPage(1);
        return term;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  /** Runs one change, then refreshes the screen and reports what happened. */
  const mutate = useCallback(
    async (path: string, data: unknown, message: string) => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await api(path, data);
        await load();
        setNotice(message);
        return true;
      } catch (problem) {
        failure(problem);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load, failure],
  );

  const signIn = useCallback(
    async (password: string) => {
      setBusy(true);
      setError('');
      try {
        await api('login', { password });
        await load();
      } catch (problem) {
        failure(problem);
      } finally {
        setBusy(false);
      }
    },
    [load, failure],
  );

  const signOut = useCallback(async () => {
    try {
      await api('logout', {});
      setAuthorized(false);
      setRows([]);
      setError('');
    } catch (problem) {
      failure(problem);
    }
  }, [failure]);

  const exportCsv = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/export', {
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          'CSVを出力できませんでした。再ログインしてお試しください。',
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'festival-participants.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        'CSVを出力しました。生徒情報を含むため、管理者だけで保管してください。',
      );
    } catch (problem) {
      failure(problem);
    } finally {
      setBusy(false);
    }
  }, [failure]);

  const chooseTab = useCallback((next: AdminTab) => {
    setTab(next);
    setPage(1);
    setNotice('');
  }, []);

  return {
    authorized,
    checking,
    busy,
    error,
    setError,
    notice,
    tab,
    chooseTab,
    kind,
    setKind,
    query,
    setQuery,
    page,
    setPage,
    rows,
    count,
    stats,
    spots,
    maps,
    settings,
    staffPinSet,
    sitePasswordSet,
    logs,
    settingsVersion,
    load,
    mutate,
    signIn,
    signOut,
    exportCsv,
  };
}
