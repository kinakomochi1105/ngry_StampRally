'use client';

import { useMemo, useState } from 'react';
import { Check, MapPinned, Navigation, UsersRound } from 'lucide-react';
import { useI18n } from '@/components/language';
import { translate, type Locale } from '@/lib/i18n';
import type { Spot } from '@/lib/types';

export type TrafficPoint = { spotId: string; recentCount: number };

export function crowdLevel(count: number) {
  if (count >= 8) return 'busy' as const;
  if (count >= 3) return 'moving' as const;
  return 'quiet' as const;
}

const crowdLabel = {
  busy: '混雑しています',
  moving: '少し動きがあります',
  quiet: '今は空いています',
} as const;

/**
 * How busy a spot is, from anonymous scan counts. `locale` is a prop rather
 * than a hook read because the admin screens render this outside a page that
 * owns the language context.
 */
export function TrafficBadge({
  count,
  locale,
}: {
  count: number;
  locale: string;
}) {
  const t = (text: string) => translate(text, locale as Locale);
  const level = crowdLevel(count);
  return (
    <span className={`traffic-badge ${level}`}>
      <UsersRound size={15} aria-hidden="true" />
      <strong>{t(crowdLabel[level])}</strong>
      <small>
        {locale === 'en'
          ? `Last 10 min · ${count} scan${count === 1 ? '' : 's'}`
          : `直近10分 · ${count}件の読み取り`}
      </small>
    </span>
  );
}

function floorOf(location: string) {
  const match = location.match(
    /(?:^|[ ·・])((?:B?\d+F)|(?:\d+階)|(?:別棟|Annex))/i,
  );
  if (!match) return 'Other';
  const value = match[1];
  if (/別棟|annex/i.test(value)) return 'Annex';
  if (value.endsWith('階')) return value;
  return value.toUpperCase();
}

function floorLabel(floor: string, locale: string) {
  if (floor === 'Annex') return locale === 'en' ? 'Annex' : '別棟';
  if (locale === 'en' && floor.endsWith('階')) return floor.replace('階', 'F');
  return floor;
}

/** A plain guide to the venue, grouped by the floor written on each location. */
export function FloorMap({
  spots,
  traffic,
  hasStamp,
  locale,
}: {
  spots: Spot[];
  traffic: TrafficPoint[];
  hasStamp: (spotId: string) => boolean;
  locale: string;
}) {
  const { t } = useI18n();
  const [selectedFloor, setSelectedFloor] = useState('');
  const trafficById = useMemo(
    () => new Map(traffic.map((point) => [point.spotId, point.recentCount])),
    [traffic],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Spot[]>();
    for (const spot of spots) {
      const floor = floorOf(spot.location);
      map.set(floor, [...(map.get(floor) ?? []), spot]);
    }
    return map;
  }, [spots]);
  const floors = [...grouped.keys()];
  const floor =
    selectedFloor && grouped.has(selectedFloor)
      ? selectedFloor
      : (floors[0] ?? '');
  const visible = floor ? (grouped.get(floor) ?? []) : [];
  const title = t('フロアマップ');

  return (
    <section className="floor-map" aria-label={title}>
      <div className="floor-map-heading">
        <div>
          <p className="eyebrow">{t('会場案内')}</p>
          <h3>{title}</h3>
          <p>{t('管理者が登録した設置場所と階情報をもとにした案内図です。')}</p>
        </div>
        <MapPinned size={31} aria-hidden="true" />
      </div>
      {floors.length ? (
        <>
          <div
            className="floor-picker"
            role="tablist"
            aria-label={t('階を選ぶ')}
          >
            {floors.map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={item === floor}
                className={item === floor ? 'active' : ''}
                onClick={() => setSelectedFloor(item)}
              >
                {floorLabel(item, locale)}
                <small>{grouped.get(item)?.length ?? 0}</small>
              </button>
            ))}
          </div>
          <div
            className="floor-map-canvas"
            aria-label={`${floorLabel(floor, locale)} ${title}`}
          >
            <div className="map-corridor" aria-hidden="true">
              <span>{t('メイン通路')}</span>
            </div>
            <p className="map-entrance">
              <Navigation size={16} aria-hidden="true" />
              {t('入口・受付')}
            </p>
            <div className="map-rooms">
              {visible.map((spot) => (
                <article
                  key={spot.id}
                  className={`map-room ${hasStamp(spot.id) ? 'collected' : ''}`}
                >
                  <span className="map-room-number">
                    {String(spots.indexOf(spot) + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <strong>{spot.name}</strong>
                    <small>{spot.description || spot.location}</small>
                  </div>
                  <TrafficBadge
                    count={trafficById.get(spot.id) ?? 0}
                    locale={locale}
                  />
                  {hasStamp(spot.id) && (
                    <Check
                      className="map-room-check"
                      size={18}
                      aria-label={t('獲得済み')}
                    />
                  )}
                </article>
              ))}
            </div>
          </div>
          <div className="traffic-legend">
            <strong>{t('混み具合の目安')}</strong>
            <span>
              <i className="quiet" />
              {t('空いている')}
            </span>
            <span>
              <i className="moving" />
              {t('少し動きあり')}
            </span>
            <span>
              <i className="busy" />
              {t('混雑')}
            </span>
          </div>
          <p className="traffic-note">
            {t(
              '混み具合は個人を識別しない、直近10分のQRコード読み取り件数による目安です。正確な待ち時間とは異なる場合があります。',
            )}
          </p>
        </>
      ) : (
        <div className="empty-state">
          {t('設置場所が登録されると、ここに表示されます。')}
        </div>
      )}
    </section>
  );
}
