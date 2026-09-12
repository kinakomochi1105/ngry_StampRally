'use client';
import { useCallback, useEffect, useState } from 'react';
import { MessageSquarePlus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/language';
import { errorMessage } from '@/lib/client';
import { reportChoices, type CrowdReading } from '@/lib/crowd';
import type { Spot } from '@/lib/types';

/** Opens the report sheet for one location. */
export function CrowdReportButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button className="crowd-report-button" variant="outline" onClick={onClick}>
      <MessageSquarePlus size={16} />
      {t('混み具合を報告')}
    </Button>
  );
}

/**
 * Three choices, worded as what a participant can see from where they are
 * standing rather than as an abstract level. Nothing about who sent it is
 * stored; the sheet says so, because people answer more honestly when they
 * know that.
 */
export function CrowdReportDialog({
  spot,
  onClose,
  onSend,
}: {
  spot: Spot | null;
  onClose: () => void;
  onSend: (spotId: string, level: CrowdReading) => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open={spot !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setError('');
          onClose();
        }
      }}
    >
      <DialogContent className="crowd-dialog" showCloseButton={false}>
        <span className="crowd-dialog-icon" aria-hidden="true">
          <UsersRound size={26} />
        </span>
        <DialogTitle>{t('いまの混み具合を教えてください')}</DialogTitle>
        <DialogDescription>
          {spot?.name}
          {spot?.location ? ` · ${spot.location}` : ''}
        </DialogDescription>
        <div className="crowd-choices">
          {reportChoices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={`crowd-choice ${choice.level}`}
              disabled={busy}
              onClick={() => {
                if (!spot) return;
                setBusy(true);
                setError('');
                void onSend(spot.id, choice.value)
                  .then(() => onClose())
                  .catch((problem: unknown) =>
                    setError(
                      errorMessage(
                        problem,
                        '混み具合を報告できませんでした。時間をおいてお試しください。',
                      ),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <i aria-hidden="true" />
              <strong>{t(choice.label)}</strong>
            </button>
          ))}
        </div>
        <p className="form-hint">
          {t(
            '報告は誰が送ったか分からない形で集計し、直近20分の平均だけを表示します。同じ場所への報告は5分に1回までです。',
          )}
        </p>
        {error && <output className="form-error">{t(error)}</output>}
        <Button variant="outline" disabled={busy} onClick={onClose}>
          {t('閉じる')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* Invitation after a scan ---------------------------------------------------
   Someone who has just read a QR code is standing at the location, which is
   the one moment they can see the queue in front of it. The invitation is
   offered there, and never again once it has been turned down for good. */

/** Remembered per browser, beside the theme and language choices. */
const promptKey = 'festival-crowd-prompt';

const muted = () => {
  try {
    return localStorage.getItem(promptKey) === 'off';
  } catch {
    return false;
  }
};

const remember = () => {
  try {
    localStorage.setItem(promptKey, 'off');
  } catch {}
};

/** Long enough for the stamp to finish landing before the sheet appears. */
const promptDelay = 1400;

/**
 * The two sheets that follow a scan: the invitation, and the report itself
 * when it is accepted. `ask` is called for every stamp that lands and stays
 * silent when this browser has asked not to be shown the invitation again.
 */
export function useCrowdPrompt() {
  const [queued, setQueued] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  const ask = useCallback((spotId: string) => {
    if (!muted()) setQueued(spotId);
  }, []);

  useEffect(() => {
    if (!queued) return;
    const timer = window.setTimeout(() => {
      setAsking(queued);
      setQueued(null);
    }, promptDelay);
    return () => window.clearTimeout(timer);
  }, [queued]);

  return {
    ask,
    asking,
    reporting,
    accept: useCallback(() => {
      setReporting(asking);
      setAsking(null);
    }, [asking]),
    dismiss: useCallback(() => setAsking(null), []),
    mute: useCallback(() => {
      remember();
      setQueued(null);
      setAsking(null);
    }, []),
    closeReport: useCallback(() => setReporting(null), []),
  };
}

/**
 * Asks — it does not collect the reading itself, so turning it down costs one
 * tap. The third action is separate from "あとで" on purpose: declining now
 * and declining forever are different answers, and only one of them should be
 * hard to give by accident.
 */
export function CrowdReportPrompt({
  spot,
  onAccept,
  onDismiss,
  onMute,
}: {
  spot: Spot | null;
  onAccept: () => void;
  onDismiss: () => void;
  onMute: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={spot !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent className="crowd-prompt" showCloseButton={false}>
        <span className="crowd-dialog-icon" aria-hidden="true">
          <UsersRound size={26} />
        </span>
        <DialogTitle>{t('この場所の混み具合を報告しませんか？')}</DialogTitle>
        <DialogDescription>
          {spot?.name}
          {spot?.location ? ` · ${spot.location}` : ''}
        </DialogDescription>
        <p className="form-hint">
          {t(
            'いまの様子を教えてもらえると、次に向かう人が空いている場所を選べます。3つから選ぶだけです。',
          )}
        </p>
        <Button className="primary-action" onClick={onAccept}>
          <MessageSquarePlus size={18} />
          {t('報告する')}
        </Button>
        <Button variant="outline" onClick={onDismiss}>
          {t('あとで')}
        </Button>
        <button type="button" className="crowd-prompt-mute" onClick={onMute}>
          {t('次回以降表示しない')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
