'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/language';
import type { ManagedSpot } from '@/hooks/use-admin';

export type Poster = { spot: ManagedSpot; image: string };

/** The sheet an organiser prints and tapes up at a location. */
export function PosterDialog({
  poster,
  onClose,
}: {
  poster: Poster | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={poster !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="admin-dialog poster-dialog"
        showCloseButton={false}
      >
        <DialogTitle>{t('設置用QRコード')}</DialogTitle>
        <DialogDescription>
          {t(
            'スマホのカメラでも、サイト内のカメラでも読み取れます。公開前に実機でお試しください。',
          )}
        </DialogDescription>
        {poster && (
          <div className="qr-poster">
            <p>{t('文化祭 STAMP RALLY')}</p>
            <h2>{poster.spot.name}</h2>
            <h3>{poster.spot.location}</h3>
            {/* QRCode output is generated locally and is not an external image. */}
            {/* eslint-disable-next-line next/no-img-element */}
            <img
              src={poster.image}
              alt={poster.spot.name + t('の設置用QRコード')}
              width={320}
              height={320}
            />
            <strong>
              {t('スマホのカメラで読み取ってください。')}
              <br />
              {t('サイトが開き、自動でスタンプが押されます。')}
            </strong>
            <small className="qr-poster-link">{poster.spot.code}</small>
            {!poster.spot.active && <p>{t('この場所は現在、非公開です。')}</p>}
          </div>
        )}
        {/* On a desktop the sheet sits on the left and its actions beside it;
            `.dialog-column` is `display: contents` on a phone. */}
        <div className="dialog-column">
          <Button onClick={() => window.print()}>
            {t('このQRコードを印刷')}
          </Button>
          <DialogClose render={<Button variant="outline" />}>
            {t('閉じる')}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Deleting every participant record: typed confirmation, no undo. */
export function PurgeDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmation: string) => void;
}) {
  const { t } = useI18n();
  const [confirmation, setConfirmation] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setConfirmation('');
        onOpenChange(value);
      }}
    >
      <DialogContent className="admin-dialog" showCloseButton={false}>
        <DialogTitle>{t('全参加データの削除')}</DialogTitle>
        <DialogDescription>
          {t(
            '全員の登録情報とスタンプ履歴を削除します。必要なCSVを先に保存してください。',
          )}
        </DialogDescription>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(confirmation);
            setConfirmation('');
          }}
        >
          <label>
            {t('「全参加データを削除」と入力')}
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="destructive"
            disabled={busy || confirmation !== '全参加データを削除'}
          >
            {t('削除する')}
          </Button>
        </form>
        <DialogClose render={<Button variant="outline" />}>
          {t('キャンセル')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
