'use client';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecoverySetup, type RecoveryReceipt } from '@/components/recovery';
import { useI18n } from '@/components/language';

/** The settings entry in the top bar. */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  const label = t('設定');
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Settings size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

/**
 * Everything a participant configures or looks up, in one sheet: the
 * walkthrough, the recovery code that moves a pass to another phone, and what
 * is stored about them. It used to sit open-ended at the foot of the stamp
 * book, where it competed with the locations for attention on every screen.
 */
export function SettingsDialog({
  open,
  nickname,
  onClose,
  onShowDemo,
  onIssued,
  onLoggedOut,
}: {
  open: boolean;
  nickname: string | null;
  onClose: () => void;
  onShowDemo: () => void;
  onIssued: (receipt: RecoveryReceipt) => Promise<void>;
  onLoggedOut: () => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="settings-dialog" showCloseButton={false}>
        <DialogTitle>{t('設定')}</DialogTitle>
        <DialogDescription>
          {t('使い方の確認、再ログインの準備、参加データの扱いはここから。')}
        </DialogDescription>

        <section className="settings-group">
          <h3>{t('使い方')}</h3>
          <p>{t('スタンプの集め方を、画面の例で順番に確認できます。')}</p>
          <Button
            className="replay-demo"
            variant="outline"
            onClick={() => {
              onClose();
              onShowDemo();
            }}
          >
            {t('使い方デモを見る')}
          </Button>
        </section>

        <section className="settings-group">
          <h3>{t('再ログイン・端末の変更')}</h3>
          <RecoverySetup
            nickname={nickname}
            onIssued={onIssued}
            onLoggedOut={onLoggedOut}
          />
        </section>

        <section className="settings-group">
          <h3>{t('参加データ')}</h3>
          <p className="policy-text">
            {t(
              'サイト内の読み取りボタンから設置QRコードを読み取ります。ニックネームに加え、生徒は学年・組・出席番号、一般客は参加IDをスタンプ履歴とともに保存します。進行状況・ランキングは管理者のみ閲覧できます。氏名・連絡先・位置情報は収集せず、カメラ映像・画像も送信しません。Cookieの有効期間と履歴の表示期間は30日です。サーバーの記録は開催後に主催者が削除します。同じ端末・ブラウザでご参加ください。Cookieの削除後や端末変更時は、ニックネームと復旧コードで再ログインできます。復旧コードを紛失した場合は、元の端末で再発行するか受付へご相談ください。',
            )}
          </p>
        </section>

        <Button variant="outline" onClick={onClose}>
          {t('閉じる')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
