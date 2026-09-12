'use client';
import { Check, ChevronRight, Map as MapIcon, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrafficBadge, type TrafficPoint } from '@/components/floor-map';
import { useI18n } from '@/components/language';
import type { Spot } from '@/lib/types';

/** Where to walk next: room, directions and how busy each spot is right now. */
export function PlacesList({
  spots,
  traffic,
  hasStamp,
  onOpenMap,
}: {
  spots: Spot[];
  traffic: TrafficPoint[];
  hasStamp: (spotId: string) => boolean;
  onOpenMap: () => void;
}) {
  const { t, locale } = useI18n();
  const recentAt = (spotId: string) =>
    traffic.find((point) => point.spotId === spotId)?.recentCount ?? 0;
  return (
    <section className="places">
      <div className="places-toolbar">
        <div>
          <strong>{t('巡る場所を選ぶ')}</strong>
          <small>{t('混み具合は1分ごとに更新されます。')}</small>
        </div>
        <Button
          className="map-open-button"
          variant="outline"
          onClick={onOpenMap}
        >
          <MapIcon size={17} />
          {t('マップを見る')}
        </Button>
      </div>
      {spots.map((spot, index) => (
        <article key={spot.id}>
          <span className="list-number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h3>{spot.name}</h3>
            <p>
              <MapPin size={14} aria-hidden="true" />
              {spot.location}
            </p>
            {spot.description && <p>{spot.description}</p>}
            <TrafficBadge count={recentAt(spot.id)} locale={locale} />
          </div>
          {hasStamp(spot.id) ? (
            <Check
              className="list-status"
              aria-label={t('獲得済み')}
              size={20}
            />
          ) : (
            <ChevronRight
              className="list-status"
              size={18}
              aria-hidden="true"
            />
          )}
        </article>
      ))}
      <Button
        className="print-list"
        variant="outline"
        onClick={() => window.print()}
      >
        {t('設置場所一覧を印刷')}
      </Button>
    </section>
  );
}
