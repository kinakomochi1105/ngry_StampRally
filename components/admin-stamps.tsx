'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/language';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client';
import { dateTime } from '@/lib/utils';
type SpotStatus = {
  id: string;
  name: string;
  location: string;
  active: number;
  collected: number;
  collectedAt: number | null;
};
export function AdminStamps({
  id,
  onUpdated,
}: {
  id: number;
  onUpdated: () => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const [spots, setSpots] = useState<SpotStatus[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const result = await api<{ spots: SpotStatus[] }>(
      '/api/admin/participants?id=' + id,
    );
    setSpots(result.spots);
  }, [id]);
  useEffect(() => {
    let active = true;
    // Fetch the protected progress when this participant editor mounts.
    // eslint-disable-next-line react/react-compiler
    void load()
      .catch((e) => {
        if (active) setError(errorMessage(e, '通信を確認してお試しください。'));
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
      <h3>{t('スタンプ達成状況を編集')}</h3>
      <p>
        {t(
          '各ボタンで即時保存します。追加分の押印日時は現在時刻となり、ランキングにも反映されます。非公開の場所は達成数に含みません。',
        )}
      </p>
      {loading ? (
        <p>{t('読み込み中…')}</p>
      ) : spots.length === 0 ? (
        <p>{t('設置場所がありません。')}</p>
      ) : (
        <ul>
          {spots.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.location}
                  {!s.active && ' · ' + t('非公開')}
                </small>
                <span
                  className={s.collected ? 'stamp-state done' : 'stamp-state'}
                >
                  {t(s.collected ? '獲得済み' : '未獲得')}
                  {s.collected && s.collectedAt ? (
                    <time
                      className="stamp-state-time"
                      dateTime={new Date(s.collectedAt * 1000).toISOString()}
                    >
                      {dateTime(s.collectedAt, locale)}
                    </time>
                  ) : null}
                </span>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                aria-label={
                  t(s.collected ? '取り消す' : '付与する') + '：' + s.name
                }
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    await api('/api/admin/participants', {
                      data: {
                        id,
                        action: 'stamp',
                        spotId: s.id,
                        collected: !s.collected,
                      },
                    });
                    await load();
                    await onUpdated();
                    setMessage('スタンプ達成状況を保存しました。');
                  } catch (e) {
                    setError(errorMessage(e, '通信を確認してお試しください。'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(s.collected ? '取り消す' : '付与する')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <output className="form-error">{t(error)}</output>}
      {message && (
        <output className="stamp-editor-message">{t(message)}</output>
      )}
    </section>
  );
}
