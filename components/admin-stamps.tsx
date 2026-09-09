'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/language';
import { Button } from '@/components/ui/button';
type SpotStatus = {
  id: string;
  name: string;
  location: string;
  active: number;
  collected: number;
};
export function AdminStamps({
  id,
  onUpdated,
}: {
  id: number;
  onUpdated: () => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const en = locale === 'en';
  const [spots, setSpots] = useState<SpotStatus[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/participants?id=' + id, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const d = (await r.json()) as { error?: string; spots: SpotStatus[] };
    if (!r.ok) throw Error(d.error);
    setSpots(d.spots);
  }, [id]);
  useEffect(() => {
    let active = true;
    // Fetch the protected progress when this participant editor mounts.
    // eslint-disable-next-line react/react-compiler
    void load()
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : '通信を確認してお試しください。',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <section className="stamp-editor">
      <h3>{en ? 'Edit stamp progress' : 'スタンプ達成状況を編集'}</h3>
      <p>
        {en
          ? 'Each button saves immediately. New stamps use the current time and affect rankings. Hidden locations do not count toward completion.'
          : '各ボタンで即時保存します。追加分の押印日時は現在時刻となり、ランキングにも反映されます。非公開の場所は達成数に含みません。'}
      </p>
      {loading ? (
        <p>{en ? 'Loading…' : '読み込み中…'}</p>
      ) : spots.length === 0 ? (
        <p>{en ? 'No locations.' : '設置場所がありません。'}</p>
      ) : (
        <ul>
          {spots.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.location}
                  {!s.active && (en ? ' · Hidden' : ' · 非公開')}
                </small>
                <span
                  className={s.collected ? 'stamp-state done' : 'stamp-state'}
                >
                  {s.collected
                    ? en
                      ? 'Collected'
                      : '獲得済み'
                    : en
                      ? 'Not collected'
                      : '未獲得'}
                </span>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                aria-label={
                  (s.collected
                    ? en
                      ? 'Revoke: '
                      : '取り消す：'
                    : en
                      ? 'Grant: '
                      : '付与する：') + s.name
                }
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    const r = await fetch('/api/admin/participants', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id,
                        action: 'stamp',
                        spotId: s.id,
                        collected: !s.collected,
                      }),
                      signal: AbortSignal.timeout(15000),
                    });
                    const d = (await r.json()) as { error?: string };
                    if (!r.ok) throw Error(d.error);
                    await load();
                    await onUpdated();
                    setMessage(
                      en
                        ? 'Stamp progress saved.'
                        : 'スタンプ達成状況を保存しました。',
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : '通信を確認してお試しください。',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {s.collected
                  ? en
                    ? 'Revoke'
                    : '取り消す'
                  : en
                    ? 'Grant stamp'
                    : '付与する'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <output className="form-error">{t(error)}</output>}
      {message && <output className="stamp-editor-message">{message}</output>}
    </section>
  );
}
