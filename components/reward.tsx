'use client';
import { useI18n } from '@/components/language';
import { useState } from 'react';
import { BadgeCheck, ShieldCheck, Gift } from 'lucide-react';
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
export function RewardSeal({
  redemption,
  locale,
}: {
  redemption: Redemption;
  locale: string;
}) {
  const { t } = useI18n();
  return (
    <div className="reward-receipt">
      <div className="reward-stamp" aria-hidden="true">
        <span>{locale === 'en' ? 'CLAIMED' : '交換済'}</span>
        <small>{formatStamped(redemption.redeemedAt, locale)}</small>
      </div>
      <div className="reward-receipt-body">
        <p className="eyebrow">
          {locale === 'en' ? 'REWARD CLAIMED' : '報酬 受け取り済み'}
        </p>
        <h3>{t('交換が完了しました')}</h3>
        <dl className="reward-times">
          {redemption.completedAt && (
            <div>
              <dt>{locale === 'en' ? 'Completed' : 'コンプリート日時'}</dt>
              <dd>{formatStamped(redemption.completedAt, locale)}</dd>
            </div>
          )}
          <div>
            <dt>{locale === 'en' ? 'Claimed' : '交換日時'}</dt>
            <dd>{formatStamped(redemption.redeemedAt, locale)}</dd>
          </div>
        </dl>
        <p className="reward-receipt-note">
          {locale === 'en'
            ? 'This record is kept by the organizers. The reward can only be claimed once.'
            : 'この記録は運営が保管します。報酬の受け取りは1回限りです。'}
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
  locale,
}: {
  open: boolean;
  onClose: () => void;
  onRedeemed: (value: Redemption) => void;
  locale: string;
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
      const r = await fetch('/api/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => {
        throw new Error('通信を確認して、もう一度お試しください。');
      });
      const d = (await r.json()) as Redemption & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setPin('');
      onRedeemed({ redeemedAt: d.redeemedAt, completedAt: d.completedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : '交換を記録できませんでした。');
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
        <DialogTitle>
          {locale === 'en'
            ? 'Please show this screen to a staff member'
            : '係員にこの画面を見せてください'}
        </DialogTitle>
        <DialogDescription>
          {locale === 'en'
            ? 'All stamps are collected. A staff member enters the PIN to hand over the reward.'
            : 'スタンプが全て集まりました。係員が暗証番号を入力すると、報酬の受け取りが記録されます。'}
        </DialogDescription>
        <form onSubmit={submit} className="reward-pin-form">
          <label>
            {locale === 'en' ? 'Staff PIN' : '係員用暗証番号'}
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
            {locale === 'en'
              ? 'For staff only. Participants cannot claim the reward on their own.'
              : '係員専用です。参加者だけでは受け取りを確定できません。'}
          </p>
          {error && <output className="form-error">{t(error)}</output>}
          <Button
            type="submit"
            className="primary-action"
            disabled={busy || pin.length < 4}
          >
            <ShieldCheck size={19} />
            {busy
              ? locale === 'en'
                ? 'Recording…'
                : '記録しています…'
              : locale === 'en'
                ? 'Confirm hand-over'
                : '交換を確定する'}
          </Button>
        </form>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          {locale === 'en' ? 'Back' : '戻る'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function RewardClaimButton({
  onClick,
  locale,
}: {
  onClick: () => void;
  locale: string;
}) {
  return (
    <Button className="primary-action reward-claim-button" onClick={onClick}>
      <BadgeCheck size={20} />
      {locale === 'en' ? 'Claim your reward' : '報酬を受け取る'}
    </Button>
  );
}
