'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorCode, errorMessage } from '@/lib/client';
import type { Profile, Spot, FestivalSettings, VenueMap } from '@/lib/types';
import { defaultSettings } from '@/lib/types';
import type { TrafficPoint } from '@/components/floor-map';
import type { CrowdReading } from '@/lib/crowd';

export type Passport = {
  profile: Profile | null;
  spots: Spot[];
  settings: FestivalSettings;
  stamps: { spotId: string; createdAt: number }[];
  traffic: TrafficPoint[];
  error?: string;
};

export type RallyToast = {
  text: string;
  tone: 'success' | 'info';
  at: number;
};

const empty: Passport = {
  profile: null,
  spots: [],
  settings: defaultSettings,
  stamps: [],
  traffic: [],
};

/**
 * A poster QR read by the phone's own camera app arrives as `/?stamp=…` (see
 * app/s/[spot]/[code]). The code waits in session storage until a participant
 * exists, so reading a QR before registering still awards that stamp as soon
 * as enrollment finishes, and a reload during enrollment does not lose it.
 */
const pendingStampKey = 'rally_pending_stamp';
const pendingStampPattern = /^[a-z0-9-]{1,64}\.[a-f0-9]{64}$/;

const readPending = () => {
  try {
    return sessionStorage.getItem(pendingStampKey);
  } catch {
    return null;
  }
};

const forgetPending = () => {
  try {
    sessionStorage.removeItem(pendingStampKey);
  } catch {}
};

/**
 * Everything the participant screen needs from the server: the passport
 * itself, the scan that adds to it, and the two ways a stamp can arrive — the
 * in-app scanner, or a link the phone's camera app opened.
 *
 * The screen only renders; nothing here reaches into the DOM.
 */
export function usePassport({
  /** Called once for each stamp that was not already in the book. */
  onCollected,
}: { onCollected?: (spotId: string) => void } = {}) {
  const [data, setData] = useState<Passport>(empty);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [freshStamp, setFreshStamp] = useState<string | null>(null);
  const [toast, setToast] = useState<RallyToast | null>(null);
  const [pendingStamp, setPendingStamp] = useState<string | null>(null);
  // True while the festival asks for its access word and this browser has not
  // given it. Every participant API answers the same way, so one flag covers
  // the whole screen.
  const [locked, setLocked] = useState(false);
  const profileId = data.profile?.id;

  /**
   * A background refresh keeps the current screen interactive: it never shows
   * the loading state, and a failure leaves the last good passport in place
   * instead of replacing it with an error.
   */
  const reload = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      setData(await api<Passport>('/api/passport'));
      setLocked(false);
      setFailed(false);
      setNotice('');
    } catch (problem) {
      // An access word set (or changed) mid-event reaches a background poll
      // too, so the screen locks itself without waiting for a reload.
      if (errorCode(problem) === 'gate') {
        setLocked(true);
        setFailed(false);
        setNotice('');
        return;
      }
      if (background) return;
      setFailed(true);
      setNotice(
        'スタンプ帳を読み込めませんでした。通信を確認して再読み込みしてください。',
      );
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  /** Exchanges the festival's access word for the pass cookie, then reloads. */
  const unlock = useCallback(
    async (password: string) => {
      await api('/api/gate', {
        data: { password },
        fallback: '合言葉を確認できませんでした。',
      });
      await reload();
    },
    [reload],
  );

  const scan = useCallback(
    async (code: string) => {
      const result = await api<{ spotId: string; duplicate: boolean }>(
        '/api/stamp',
        {
          data: { code },
          offline: '通信を確認して、同じQRコードで再試行してください。',
          fallback:
            '押印を確認できませんでした。同じQRコードで再試行できます。',
        },
      );
      if (!result.duplicate) {
        setFreshStamp(result.spotId);
        navigator.vibrate?.([18, 40, 24]);
        onCollected?.(result.spotId);
      }
      setData((current) => ({
        ...current,
        stamps: current.stamps.some((s) => s.spotId === result.spotId)
          ? current.stamps
          : [
              ...current.stamps,
              {
                spotId: result.spotId,
                createdAt: Math.floor(Date.now() / 1000),
              },
            ],
      }));
      setToast({
        text: result.duplicate
          ? 'このスタンプは獲得済みです。'
          : 'スタンプを獲得しました！',
        tone: result.duplicate ? 'info' : 'success',
        at: Date.now(),
      });
    },
    [onCollected],
  );

  /**
   * A participant's own reading of how busy a spot is. The reply carries that
   * spot's new average, which is merged in so the badge updates immediately
   * instead of waiting for the next poll.
   */
  const report = useCallback(async (spotId: string, level: CrowdReading) => {
    const result = await api<{
      spotId: string;
      reportCount: number;
      reportAverage: number | null;
    }>('/api/report', {
      data: { spotId, level },
      fallback: '混み具合を報告できませんでした。時間をおいてお試しください。',
    });
    setData((current) => ({
      ...current,
      traffic: current.traffic.map((point) =>
        point.spotId === result.spotId
          ? {
              ...point,
              reportCount: result.reportCount,
              reportAverage: result.reportAverage,
            }
          : point,
      ),
    }));
    setToast({
      text: '混み具合を報告しました。ありがとうございます！',
      tone: 'success',
      at: Date.now(),
    });
  }, []);

  /** Applied locally so the seal appears at once; the next refresh confirms it. */
  const applyRedemption = useCallback(
    (value: { redeemedAt: number; completedAt: number | null }) => {
      setData((current) =>
        current.profile
          ? { ...current, profile: { ...current.profile, ...value } }
          : current,
      );
      setToast({
        text: '報酬の交換を記録しました。',
        tone: 'success',
        at: Date.now(),
      });
    },
    [],
  );

  useEffect(() => {
    // Server-backed registration and passport are loaded on first access.
    // eslint-disable-next-line react/react-compiler
    void reload();
  }, [reload]);

  useEffect(() => {
    // Runs once: the link is consumed from the address bar so a later reload
    // or a shared URL does not replay the same scan.
    const url = new URL(window.location.href);
    const arrived = url.searchParams.get('stamp');
    if (arrived) {
      url.searchParams.delete('stamp');
      window.history.replaceState(
        null,
        '',
        url.pathname + url.search + url.hash,
      );
      try {
        sessionStorage.setItem(pendingStampKey, arrived);
      } catch {}
    }
    const code = arrived ?? readPending();
    // eslint-disable-next-line react/react-compiler
    if (code && pendingStampPattern.test(code)) setPendingStamp(code);
    else forgetPending();
  }, []);

  useEffect(() => {
    if (!pendingStamp || !profileId) return;
    const [spotId, signature] = pendingStamp.split('.');
    // Consumed before the request so a re-render cannot stamp twice.
    // eslint-disable-next-line react/react-compiler
    setPendingStamp(null);
    forgetPending();
    void scan(`/s/${spotId}/${signature}`).catch((problem: unknown) => {
      setNotice(
        errorMessage(
          problem,
          'スタンプを押せませんでした。サイト内の読み取りボタンからお試しください。',
        ),
      );
    });
  }, [pendingStamp, profileId, scan]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!profileId) return;
    // Participants leave the page in a pocket while walking between spots, so
    // polling pauses while hidden and catches up the moment it returns.
    let timer = 0;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => void reload(true), 60_000);
    };
    const visibility = () => {
      if (document.hidden) window.clearInterval(timer);
      else {
        void reload(true);
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [profileId, reload]);

  return {
    data,
    loading,
    locked,
    unlock,
    failed,
    notice,
    setNotice,
    pendingStamp,
    freshStamp,
    clearFreshStamp: useCallback(() => setFreshStamp(null), []),
    toast,
    reload,
    scan,
    report,
    applyRedemption,
  };
}

/**
 * The venue maps, asked for once rather than on every poll: an organiser
 * uploads them before the festival and rarely touches them during it, and the
 * pictures themselves are fetched by the browser as ordinary images.
 *
 * `ready` is false while the access word is still being asked for, so nothing
 * is requested until the visitor is allowed in.
 */
export function useVenueMaps(ready: boolean) {
  const [maps, setMaps] = useState<VenueMap[]>([]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void api<{ maps: VenueMap[] }>('/api/map')
      .then((data) => {
        // A missing map is not worth an error on the stamp screen; the
        // generated guide stands in for it.
        if (active) setMaps(Array.isArray(data.maps) ? data.maps : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ready]);
  return maps;
}

/**
 * Registers the read-only "show the locations" tool with the host, when the
 * page is opened by one that offers `document.modelContext`. Participant data
 * is never exposed: only the names and rooms already printed on the page.
 */
export function useLocationsTool(spots: Spot[], onShow: () => void) {
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
              onShow();
              return {
                spots: spots.map((s) => ({
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
  }, [spots, onShow]);
}
