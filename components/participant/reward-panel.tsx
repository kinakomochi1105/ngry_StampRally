'use client';
import { ChevronRight, Gift, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/progress-bar';
import {
  RewardClaimButton,
  RewardSeal,
  type Redemption,
} from '@/components/reward';
import { useI18n } from '@/components/language';

/** How far the rally still has to go, and the hand-over once it is finished. */
export function RewardPanel({
  count,
  total,
  redemption,
  onClaim,
  onFindNext,
}: {
  count: number;
  total: number;
  redemption: Redemption | null;
  onClaim: () => void;
  onFindNext: () => void;
}) {
  const { t } = useI18n();
  const complete = total > 0 && count === total;
  return (
    <section className="reward-progress">
      <span className={complete ? 'reward-symbol complete' : 'reward-symbol'}>
        {complete ? <Trophy size={42} /> : <Gift size={42} />}
      </span>
      <p className="eyebrow">{t('コンプリートへの道')}</p>
      <h3>
        {t(
          !total
            ? 'ただいま準備中'
            : complete
              ? '全スタンプ達成！'
              : 'コンプリートまで',
        )}
      </h3>
      {total > 0 && (
        <>
          <p className="reward-remaining">
            <strong>{total - count}</strong>
            <span>{t('個')}</span>
          </p>
          <ProgressBar value={count} max={total} label={t('スタンプ達成率')} />
          <p>
            {count} / {total} {t('スタンプ獲得')}
          </p>
        </>
      )}
      <p className="reward-description">
        {t(
          complete
            ? '公開中のスポットをすべて巡りました。おめでとうございます！'
            : '公開中のスポットでスタンプを集めて、コンプリートを目指しましょう。',
        )}
      </p>
      {redemption ? (
        <RewardSeal redemption={redemption} />
      ) : (
        complete && <RewardClaimButton onClick={onClaim} />
      )}
      <div className="reward-note">
        <strong>{t('報酬について')}</strong>
        <p>
          {t(
            redemption
              ? '報酬はお渡し済みです。ご不明な点は運営案内までお問い合わせください。'
              : complete
                ? '受付で係員にこの画面をお見せください。係員が確認して受け取りを記録します。'
                : '報酬の内容・受け取り方法は、文化祭の運営案内をご確認ください。',
          )}
        </p>
      </div>
      {!complete && total > 0 && (
        <Button variant="outline" onClick={onFindNext}>
          {t('次の設置場所を確認')}
          <ChevronRight size={17} />
        </Button>
      )}
    </section>
  );
}
