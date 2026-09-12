'use client';
import { Stamp, Trophy } from 'lucide-react';
import { ProgressBar } from '@/components/progress-bar';
import { useI18n } from '@/components/language';
import { profileLabel, type Profile } from '@/lib/types';

/**
 * The one card a participant looks at between spots: who they are, how many
 * stamps they hold, and what to do next. Identity and progress used to be two
 * separate blocks; joined, the whole answer fits above the fold on a phone.
 */
export function PassportCard({
  profile,
  count,
  total,
  celebrate,
}: {
  profile: Profile;
  count: number;
  total: number;
  /** True while a newly collected stamp is still animating. */
  celebrate: boolean;
}) {
  const { t, locale } = useI18n();
  const complete = total > 0 && count === total;
  const label = profileLabel(profile, locale);
  const message = !total
    ? 'スポットはただいま準備中です。'
    : complete
      ? '全スポット達成、おめでとう！'
      : `あと${total - count}個。設置場所でQRコードを読み取ろう。`;
  return (
    <section
      className={complete ? 'passport-card complete' : 'passport-card'}
      aria-label={t('あなたの参加証')}
    >
      <p className="eyebrow">{t('あなたの参加証')}</p>
      <h1>{profile.nickname ?? label}</h1>
      <p className="passport-id">{label}</p>
      <div className="passport-progress">
        <p className="passport-count">
          <span>
            {complete ? (
              <Trophy
                size={20}
                aria-hidden="true"
                className={celebrate ? 'completion-pop' : undefined}
              />
            ) : (
              <Stamp size={20} aria-hidden="true" />
            )}
            {t(complete ? 'コンプリート！' : '集めたスタンプ')}
          </span>
          <span>
            <b key={count} className="count-value">
              {count}
            </b>
            <em> / {total}</em>
          </span>
        </p>
        <ProgressBar value={count} max={total} label={t('集めたスタンプ')} />
      </div>
      <p className="passport-message">{t(message)}</p>
    </section>
  );
}
