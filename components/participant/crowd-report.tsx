'use client';
import { useState } from 'react';
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
