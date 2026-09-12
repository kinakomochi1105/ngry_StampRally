'use client';
import { useState } from 'react';
import { Check, ChevronRight, Map as MapIcon, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  emptyPoint,
  TrafficBadge,
  type TrafficPoint,
} from '@/components/floor-map';
import {
  CrowdReportButton,
  CrowdReportDialog,
} from '@/components/participant/crowd-report';
import { useI18n } from '@/components/language';
import type { CrowdReading } from '@/lib/crowd';
import type { Spot } from '@/lib/types';

/** Where to walk next: room, directions and how busy each spot is right now. */
export function PlacesList({
  spots,
  traffic,
  hasStamp,
  onOpenMap,
  onReport,
}: {
  spots: Spot[];
  traffic: TrafficPoint[];
  hasStamp: (spotId: string) => boolean;
  onOpenMap: () => void;
  onReport: (spotId: string, level: CrowdReading) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [reporting, setReporting] = useState<Spot | null>(null);
  const pointFor = (spotId: string) =>
    traffic.find((point) => point.spotId === spotId) ?? emptyPoint(spotId);
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
            <TrafficBadge point={pointFor(spot.id)} locale={locale} />
            <CrowdReportButton onClick={() => setReporting(spot)} />
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
      <CrowdReportDialog
        spot={reporting}
        onClose={() => setReporting(null)}
        onSend={onReport}
      />
    </section>
  );
}
