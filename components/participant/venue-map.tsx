'use client';
import { useState } from 'react';
import { Check, MapPin, Minus, Plus, X } from 'lucide-react';
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
import type { MapArea, Spot, VenueMap } from '@/lib/types';

/** The picture, addressed by the version it was last saved at. */
const mapImageUrl = (map: VenueMap) => `/api/map/${map.id}?v=${map.updatedAt}`;

const zoomSteps = [1, 1.6, 2.4, 3.2];

/**
 * The venue map an organiser uploaded, with the areas they drew over it.
 *
 * The picture is whatever the school already prints — a floor plan, a site
 * map — and the areas are rectangles in fractions of it, so they sit on the
 * right room at any size. Tapping one opens that group: its room, how busy it
 * is, and whether the stamp is already in the book.
 */
export function VenueMapView({
  maps,
  spots,
  traffic,
  hasStamp,
  onReport,
}: {
  maps: VenueMap[];
  spots: Spot[];
  traffic: TrafficPoint[];
  hasStamp: (spotId: string) => boolean;
  onReport: (spotId: string, level: CrowdReading) => Promise<void>;
}) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState('');
  const map = maps.find((item) => item.id === chosen) ?? maps[0];
  if (!map) return null;
  return (
    <>
      {maps.length > 1 && (
        <div
          className="floor-picker"
          role="tablist"
          aria-label={t('マップを選ぶ')}
        >
          {maps.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={item.id === map.id}
              className={item.id === map.id ? 'active' : ''}
              onClick={() => setChosen(item.id)}
            >
              {item.name}
              <small>{item.areas.filter((one) => one.spotId).length}</small>
            </button>
          ))}
        </div>
      )}
      {/* Keyed by the map, so switching to another one starts it fresh: no
          area open, no zoom carried over, no stale load failure. */}
      <OneMap
        key={map.id}
        map={map}
        spots={spots}
        traffic={traffic}
        hasStamp={hasStamp}
        onReport={onReport}
      />
    </>
  );
}

function OneMap({
  map,
  spots,
  traffic,
  hasStamp,
  onReport,
}: {
  map: VenueMap;
  spots: Spot[];
  traffic: TrafficPoint[];
  hasStamp: (spotId: string) => boolean;
  onReport: (spotId: string, level: CrowdReading) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [openArea, setOpenArea] = useState('');
  const [zoom, setZoom] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState<Spot | null>(null);

  const spotOf = (area: MapArea) =>
    spots.find((spot) => spot.id === area.spotId) ?? null;
  const numberOf = (spot: Spot) => spots.indexOf(spot) + 1;
  const area = map.areas.find((item) => item.id === openArea) ?? null;
  const openSpot = area ? spotOf(area) : null;
  const pointFor = (spotId: string) =>
    traffic.find((point) => point.spotId === spotId) ?? emptyPoint(spotId);

  return (
    <section className="venue-map" aria-label={map.name}>
      <div className="venue-map-tools">
        <div className="venue-zoom">
          <button
            type="button"
            aria-label={t('縮小')}
            disabled={zoom === 0}
            onClick={() => setZoom((step) => Math.max(0, step - 1))}
          >
            <Minus size={17} aria-hidden="true" />
          </button>
          <span>{Math.round(zoomSteps[zoom] * 100)}%</span>
          <button
            type="button"
            aria-label={t('拡大')}
            disabled={zoom === zoomSteps.length - 1}
            onClick={() =>
              setZoom((step) => Math.min(zoomSteps.length - 1, step + 1))
            }
          >
            <Plus size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Zoomed in, the picture is wider than the screen and this box scrolls
          sideways over it. */}
      <div className="venue-map-frame">
        <div
          className="venue-map-stage"
          style={{
            width: `${zoomSteps[zoom] * 100}%`,
            aspectRatio: `${map.width} / ${map.height}`,
          }}
        >
          {/* The picture is an organiser's upload served from our own API, not
              a remote asset, so the plain tag is what is wanted here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImageUrl(map)}
            alt={map.name}
            draggable={false}
            onError={() => setFailed(true)}
          />
          {map.areas.map((item) => {
            const spot = spotOf(item);
            const collected = spot ? hasStamp(spot.id) : false;
            const style = {
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              width: `${item.w * 100}%`,
              height: `${item.h * 100}%`,
              // The organiser's own colours for this button, when they set
              // any; the stylesheet's own colours stand in otherwise. A
              // collected room is filled in more strongly, the way it is in
              // the default colours.
              ...(item.bg
                ? {
                    borderColor: item.bg,
                    background: `color-mix(in srgb, ${item.bg} ${collected ? 55 : 30}%, transparent)`,
                  }
                : null),
              ...(item.fg ? { color: item.fg } : null),
            };
            if (!spot)
              return (
                <span
                  key={item.id}
                  className="venue-area marker"
                  style={style}
                  aria-hidden="true"
                >
                  <em
                    style={
                      item.bg || item.fg
                        ? {
                            background: item.bg || undefined,
                            color: item.fg || undefined,
                          }
                        : undefined
                    }
                  >
                    {item.label}
                  </em>
                </span>
              );
            return (
              <button
                key={item.id}
                type="button"
                className={`venue-area${collected ? ' collected' : ''}${item.id === openArea ? ' open' : ''}`}
                style={style}
                aria-label={`${spot.name}（${spot.location}）`}
                aria-pressed={item.id === openArea}
                onClick={() => setOpenArea(item.id === openArea ? '' : item.id)}
              >
                <span
                  className="venue-area-pin"
                  style={
                    item.bg || item.fg
                      ? {
                          background: item.bg || undefined,
                          color: item.fg || undefined,
                        }
                      : undefined
                  }
                >
                  {collected ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    String(numberOf(spot)).padStart(2, '0')
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {failed && (
        <output className="notice error">
          <span>{t('地図の画像を読み込めませんでした。')}</span>
        </output>
      )}

      {/* What the tapped area is. It sits under the picture rather than over
          it, so it never covers the room someone is looking at. */}
      {openSpot && (
        <article className="venue-area-card">
          <button
            type="button"
            className="venue-area-close"
            aria-label={t('閉じる')}
            onClick={() => setOpenArea('')}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <span className="list-number">
            {String(numberOf(openSpot)).padStart(2, '0')}
          </span>
          <div>
            <h3>{openSpot.name}</h3>
            <p>
              <MapPin size={14} aria-hidden="true" />
              {openSpot.location}
            </p>
            {openSpot.description && <p>{openSpot.description}</p>}
            <TrafficBadge point={pointFor(openSpot.id)} locale={locale} />
            <div className="venue-area-actions">
              <CrowdReportButton onClick={() => setReporting(openSpot)} />
              {hasStamp(openSpot.id) && (
                <span className="venue-area-done">
                  <Check size={15} aria-hidden="true" />
                  {t('獲得済み')}
                </span>
              )}
            </div>
          </div>
        </article>
      )}

      <CrowdReportDialog
        spot={reporting}
        onClose={() => setReporting(null)}
        onSend={onReport}
      />

      <Button
        className="print-list"
        variant="outline"
        onClick={() => window.print()}
      >
        {t('この地図を印刷')}
      </Button>
    </section>
  );
}
