'use client';
import { Button } from '@/components/ui/button';
import { RecoverySetup, type RecoveryReceipt } from '@/components/recovery';
import { useI18n } from '@/components/language';

/**
 * Help, re-login and the data notice. Collapsed by default so it never comes
 * between a participant and the next stamp, and opened automatically while a
 * nickname is still missing — that is when the recovery code matters most.
 */
export function HelpCenter({
  nickname,
  onShowDemo,
  onIssued,
  onLoggedOut,
}: {
  nickname: string | null;
  onShowDemo: () => void;
  onIssued: (receipt: RecoveryReceipt) => Promise<void>;
  onLoggedOut: () => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <details className="help-center" open={!nickname || undefined}>
      <summary>{t('使い方・再ログイン・参加データ')}</summary>
      <Button className="replay-demo" variant="outline" onClick={onShowDemo}>
        {t('使い方デモを見る')}
      </Button>
      <RecoverySetup
        nickname={nickname}
        onIssued={onIssued}
        onLoggedOut={onLoggedOut}
      />
      <details className="policy">
        <summary>{t('参加データ・使い方について')}</summary>
        <p>
          {t(
            'サイト内の読み取りボタンから設置QRコードを読み取ります。ニックネームに加え、生徒は学年・組・出席番号、一般客は参加IDをスタンプ履歴とともに保存します。進行状況・ランキングは管理者のみ閲覧できます。氏名・連絡先・位置情報は収集せず、カメラ映像・画像も送信しません。Cookieの有効期間と履歴の表示期間は30日です。サーバーの記録は開催後に主催者が削除します。同じ端末・ブラウザでご参加ください。Cookieの削除後や端末変更時は、ニックネームと復旧コードで再ログインできます。復旧コードを紛失した場合は、元の端末で再発行するか受付へご相談ください。',
          )}
        </p>
      </details>
    </details>
  );
}
