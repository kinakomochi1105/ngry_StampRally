'use client';
import { MapPin, Plus, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpotIcon } from '@/components/spot-icon';
import { useI18n } from '@/components/language';
import type { Spot } from '@/lib/types';
import type { ManagedSpot } from '@/hooks/use-admin';

/** The locations a QR code can be printed for, and whether each one counts. */
export function SpotsPanel({
  spots,
  busy,
  onEdit,
  onPrint,
  onSeed,
}: {
  spots: ManagedSpot[];
  busy: boolean;
  onEdit: (spot: Partial<Spot>) => void;
  onPrint: (spot: ManagedSpot) => void;
  onSeed: () => void;
}) {
  const { t } = useI18n();
  return (
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
            onEdit({
              name: '',
              location: '',
              description: '',
              icon: '',
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
          <Button disabled={busy} onClick={onSeed}>
            {t('仮の6か所を作成')}
          </Button>
        </div>
      ) : (
        <div className="admin-spots">
          {spots.map((spot) => (
            <article key={spot.id}>
              <div className="spot-card-head">
                <span className="spot-card-icon">
                  <SpotIcon icon={spot.icon} index={spot.sortOrder} size={24} />
                </span>
                <span className={spot.active ? 'type-tag' : 'type-tag guest'}>
                  {t(spot.active ? '公開中' : '非公開')}
                </span>
              </div>
              <h3>{spot.name}</h3>
              <p>
                <MapPin size={16} aria-hidden="true" />
                {spot.location}
              </p>
              <small>
                {spot.description || t('案内なし')}
                {t('· 表示順')}
                {spot.sortOrder}
              </small>
              <div>
                <Button variant="outline" onClick={() => onEdit({ ...spot })}>
                  {t('編集')}
                </Button>
                <Button variant="outline" onClick={() => onPrint(spot)}>
                  <QrCode size={16} />
                  {t('QRコード・印刷')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
