'use client';
import { useState } from 'react';
import { BadgeCheck, Gift, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/components/language';
import { api, errorMessage } from '@/lib/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export type Redemption = { redeemedAt: number; completedAt: number | null };

export function formatStamped(value: number, locale: string) {
  const d = new Date(value * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return locale === 'en'
    ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The seal shown once staff have handed the reward over. */
export function RewardSeal({ redemption }: { redemption: Redemption }) {
  const { t, locale } = useI18n();
  return (
    <div className="reward-receipt">
      <p className="reward-stamp" aria-hidden="true">
        <span>{t('交換済')}</span>
        <small>{formatStamped(redemption.redeemedAt, locale)}</small>
      </p>
      <div className="reward-receipt-body">
        <p className="eyebrow">{t('報酬 受け取り済み')}</p>
        <h3>{t('交換が完了しました')}</h3>
        <dl className="reward-times">
          {redemption.completedAt && (
            <div>
              <dt>{t('コンプリート日時')}</dt>
              <dd>{formatStamped(redemption.completedAt, locale)}</dd>
            </div>
          )}
          <div>
            <dt>{t('交換日時')}</dt>
            <dd>{formatStamped(redemption.redeemedAt, locale)}</dd>
          </div>
        </dl>
        <p className="reward-receipt-note">
          {t('この記録は運営が保管します。報酬の受け取りは1回限りです。')}
        </p>
      </div>
    </div>
  );
}

/** Staff-confirmed hand-over: the participant shows this screen to staff. */
export function RewardClaimDialog({
  open,
  onClose,
  onRedeemed,
}: {
  open: boolean;
  onClose: () => void;
  onRedeemed: (value: Redemption) => void;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<Redemption>('/api/reward', {
        data: { pin },
        offline: '通信を確認して、もう一度お試しください。',
        fallback: '交換を記録できませんでした。',
      });
      setPin('');
      onRedeemed({
        redeemedAt: result.redeemedAt,
        completedAt: result.completedAt,
      });
    } catch (problem) {
      setError(errorMessage(problem, '交換を記録できませんでした。'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) {
          setPin('');
          setError('');
          onClose();
        }
      }}
    >
      <DialogContent className="reward-dialog" showCloseButton={false}>
        <span className="reward-dialog-icon" aria-hidden="true">
          <Gift size={30} />
        </span>
        <DialogTitle>{t('係員にこの画面を見せてください')}</DialogTitle>
        <DialogDescription>
          {t(
            'スタンプが全て集まりました。係員が暗証番号を入力すると、報酬の受け取りが記録されます。',
          )}
        </DialogDescription>
        <form onSubmit={submit} className="reward-pin-form">
          <label>
            {t('係員用暗証番号')}
            <input
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8))
              }
              inputMode="numeric"
              autoComplete="off"
              type="password"
              placeholder="••••"
              required
            />
          </label>
          <p className="form-hint">
            {t('係員専用です。参加者だけでは受け取りを確定できません。')}
          </p>
          {error && <output className="form-error">{t(error)}</output>}
          <Button
            type="submit"
            className="primary-action"
            disabled={busy || pin.length < 4}
          >
            <ShieldCheck size={19} />
            {t(busy ? '記録しています…' : '交換を確定する')}
          </Button>
        </form>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          {t('戻る')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function RewardClaimButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button className="primary-action reward-claim-button" onClick={onClick}>
      <BadgeCheck size={20} />
      {t('報酬を受け取る')}
    </Button>
  );
}
