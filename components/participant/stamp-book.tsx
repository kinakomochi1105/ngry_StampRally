'use client';
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { SpotIcon } from '@/components/spot-icon';
import { useI18n } from '@/components/language';
import type { Spot } from '@/lib/types';

/**
 * The stamp book itself. A freshly collected stamp is scrolled into view and
 * animates once; `onSettled` clears that state when the animation ends.
 */
export function StampBook({
  spots,
  hasStamp,
  freshStamp,
  onSettled,
}: {
  spots: Spot[];
  hasStamp: (spotId: string) => boolean;
  freshStamp: string | null;
  onSettled: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!freshStamp) return;
    const card = document.querySelector('.stamp-card.freshly-stamped');
    // A behaviour option overrides the CSS scroll-behavior reset, so the
    // reduced-motion preference has to be checked here as well.
    card?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [freshStamp]);

  return (
    <div className="stamp-grid">
      {spots.map((spot, index) => {
        const collected = hasStamp(spot.id);
        const fresh = freshStamp === spot.id;
        return (
          <article
            key={spot.id}
            className={
              (collected ? 'stamp-card collected' : 'stamp-card') +
              (fresh ? ' freshly-stamped' : '')
            }
            onAnimationEnd={(e) => {
              if (e.animationName === 'rally-stamp-press') onSettled();
            }}
          >
            <span className="spot-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="stamp-circle">
              <SpotIcon icon={spot.icon} index={index} size={34} />
              {fresh && <i className="stamp-ripple" aria-hidden="true" />}
            </div>
            <h3>{spot.name}</h3>
            <p>{spot.location}</p>
            <span className="uncollected">
              {collected ? (
                <>
                  <Check size={12} aria-hidden="true" />
                  {t('獲得済み')}
                </>
              ) : (
                t('未獲得')
              )}
            </span>
          </article>
        );
      })}
    </div>
  );
}
