'use client';

import { useMemo, useState } from 'react';
import { Check, MapPinned, Navigation, UsersRound } from 'lucide-react';
import type { Spot } from '@/lib/types';

export type TrafficPoint = { spotId: string; recentCount: number };

export function crowdLevel(count: number) {
  if (count >= 8) return 'busy' as const;
  if (count >= 3) return 'moving' as const;
  return 'quiet' as const;
}

export function TrafficBadge({
  count,
  locale,
}: {
  count: number;
  locale: string;
}) {
  const level = crowdLevel(count);
  const label =
    locale === 'en'
      ? level === 'busy'
        ? 'Busy now'
        : level === 'moving'
          ? 'Some activity'
          : 'Quiet now'
      : level === 'busy'
        ? '混雑しています'
        : level === 'moving'
          ? '少し動きがあります'
          : '今は空いています';
  const detail =
    locale === 'en'
      ? `Last 10 min · ${count} scan${count === 1 ? '' : 's'}`
      : `直近10分 · ${count}件の読み取り`;
  return (
    <span className={`traffic-badge ${level}`}>
      <UsersRound size={15} aria-hidden="true" />
      <strong>{label}</strong>
      <small>{detail}</small>
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
  const title = locale === 'en' ? 'Floor map' : 'フロアマップ';
  return (
    <section className="floor-map" aria-label={title}>
      <div className="floor-map-heading">
        <div>
          <p className="eyebrow">
            {locale === 'en' ? 'FIND YOUR WAY' : '会場案内'}
          </p>
          <h3>{title}</h3>
          <p>
            {locale === 'en'
              ? 'A simple guide based on the locations registered by the organizers.'
              : '管理者が登録した設置場所と階情報をもとにした案内図です。'}
          </p>
        </div>
        <MapPinned size={31} aria-hidden="true" />
      </div>
      {floors.length ? (
        <>
          <div
            className="floor-picker"
            role="tablist"
            aria-label={locale === 'en' ? 'Floor' : '階を選ぶ'}
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
              <span>{locale === 'en' ? 'Main corridor' : 'メイン通路'}</span>
            </div>
            <div className="map-entrance">
              <Navigation size={16} />
              {locale === 'en' ? 'You are here / Entrance' : '入口・受付'}
            </div>
            <div className="map-rooms">
              {visible.map((spot, index) => {
                const count = trafficById.get(spot.id) ?? 0;
                return (
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
                    <TrafficBadge count={count} locale={locale} />
                    {hasStamp(spot.id) && (
                      <Check
                        className="map-room-check"
                        size={18}
                        aria-label={locale === 'en' ? 'Collected' : '獲得済み'}
                      />
                    )}
                    <span className="map-room-index" aria-hidden="true">
                      {index + 1}
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="traffic-legend">
            <strong>
              {locale === 'en' ? 'Crowd guide' : '混み具合の目安'}
            </strong>
            <span>
              <i className="quiet" />
              {locale === 'en' ? 'Quiet' : '空いている'}
            </span>
            <span>
              <i className="moving" />
              {locale === 'en' ? 'Some activity' : '少し動きあり'}
            </span>
            <span>
              <i className="busy" />
              {locale === 'en' ? 'Busy' : '混雑'}
            </span>
          </div>
          <p className="traffic-note">
            {locale === 'en'
              ? 'Crowd levels use anonymous QR scan counts from the last 10 minutes. They are only a guide and do not show an exact wait time.'
              : '混み具合は個人を識別しない、直近10分のQRコード読み取り件数による目安です。正確な待ち時間とは異なる場合があります。'}
          </p>
        </>
      ) : (
        <div className="empty-state">
          {locale === 'en'
            ? 'The map will appear when locations are ready.'
            : '設置場所が登録されると、ここに表示されます。'}
        </div>
      )}
    </section>
  );
}
