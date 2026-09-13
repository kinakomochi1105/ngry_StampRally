'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { BadgeCheck, Gift, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/components/language';
import { api, errorMessage, isUnauthorized } from '@/lib/client';
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

/** How often the open claim screen asks for a fresh code and checks for the hand-over. */
const pollMs = 3000;

type CodeAnswer =
  | { code: string; refreshAt: number }
  | { redeemedAt: number; completedAt: number | null };

/** "000123 4567 8901": the pass number, then the check digits in two fours. */
const groupCode = (code: string) =>
  [code.slice(0, -8), code.slice(-8, -4), code.slice(-4)].join(' ');

/**
 * The same code three ways, so whatever the desk has can read it: a Code128
 * barcode for a handheld scanner, a QR code for a phone camera, and the digits
 * for when both fail. Always black on white with a quiet margin, whatever the
 * theme: a scanner reads contrast, not colour tokens.
 */
export function RewardCode({ code }: { code: string }) {
  const { t } = useI18n();
  const [bars, setBars] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => {
    let cancelled = false;
    // Loaded only when a finished participant opens the claim screen. The
    // bars are drawn into a detached SVG and shown as an image, so both codes
    // are plain images with a text alternative.
    void import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled) return;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, code, {
        format: 'CODE128C',
        width: 2,
        height: 76,
        margin: 14,
        displayValue: false,
        background: '#ffffff',
        lineColor: '#000000',
      });
      // A viewBox lets the image shrink on a screen narrower than the bars.
      const size = (name: string) => parseFloat(svg.getAttribute(name) ?? '0');
      svg.setAttribute('viewBox', `0 0 ${size('width')} ${size('height')}`);
      setBars(
        'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(new XMLSerializer().serializeToString(svg)),
      );
    });
    void QRCode.toDataURL(code, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return (
    <div className="reward-code">
      {/* Both are data URLs drawn in the page: nothing for next/image to fetch. */}
      {bars && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="reward-code-bars"
          src={bars}
          alt={t('引き換えバーコード')}
        />
      )}
      <p className="reward-code-digits">{groupCode(code)}</p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="reward-code-qr"
          src={qr}
          alt={t('引き換えQRコード')}
          width={148}
          height={148}
        />
      )}
    </div>
  );
}

/**
 * The claim screen. The participant shows the code and staff read it at the
 * desk, which records the hand-over on their side; this screen notices within
 * a few seconds and turns into the receipt. The staff PIN typed on this phone
 * stays underneath, folded, for a desk without a scanner or with no signal on
 * the staff side.
 */
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
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  // The parent passes a fresh callback on every render; the polling loop
  // should not restart each time it does.
  const redeemed = useRef(onRedeemed);
  useEffect(() => {
    redeemed.current = onRedeemed;
  }, [onRedeemed]);

  // Asks again every few seconds while open. A failed request keeps the last
  // code on screen: it stays valid for several minutes, and a desk with a weak
  // signal should not lose the barcode it is about to read.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let finished = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (cancelled || finished || inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      try {
        const answer = await api<CodeAnswer>('/api/reward', {
          offline: '通信を確認しています…',
          fallback: '引き換えコードを表示できませんでした。',
          timeout: 8000,
        });
        if (cancelled) return;
        if ('redeemedAt' in answer) {
          finished = true;
          redeemed.current({
            redeemedAt: answer.redeemedAt,
            completedAt: answer.completedAt,
          });
        } else {
          setCode(answer.code);
          setCodeError('');
        }
      } catch (problem) {
        if (cancelled) return;
        if (isUnauthorized(problem)) finished = true;
        setCodeError(
          errorMessage(problem, '引き換えコードを表示できませんでした。'),
        );
      } finally {
        inFlight = false;
      }
      if (!cancelled && !finished && document.visibilityState === 'visible')
        timer = setTimeout(() => void poll(), pollMs);
    }
    // Hidden, the loop stops; coming back to the screen resumes it at once.
    function visibility() {
      if (document.visibilityState === 'visible') void poll();
      else clearTimeout(timer);
    }
    void poll();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [open]);

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
            'スタンプが全て集まりました。係員がバーコードを読み取ると、報酬の受け取りが記録されます。',
          )}
        </DialogDescription>
        {code ? (
          <RewardCode code={code} />
        ) : (
          !codeError && (
            <p className="reward-code-loading">
              {t('引き換えコードを準備しています…')}
            </p>
          )
        )}
        <output className={codeError ? 'form-error' : 'reward-code-status'}>
          {codeError
            ? t(codeError)
            : code &&
              t(
                '読み取られると、この画面が自動で受け取り記録に変わります。読み取りにくいときは画面を明るくしてください。',
              )}
        </output>
        <details className="reward-pin-fallback">
          <summary>{t('暗証番号で確定する（係員用）')}</summary>
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
        </details>
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
