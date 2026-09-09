'use client';
import { useI18n } from '@/components/language';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { validateNickname } from '@/lib/nickname';
export type RecoveryReceipt = { nickname: string; recoveryCode: string };
async function request(path: string, data: unknown) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  const result = (await r.json()) as RecoveryReceipt & { error?: string };
  if (!r.ok) throw new Error(result.error ?? '操作を完了できませんでした。');
  return result;
}
export function RecoveryLogin({
  onRestored,
}: {
  onRestored: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="enrollment">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>
        {t('スタンプ帳に')}
        <br />
        {t('おかえりなさい。')}
      </h1>
      <p className="enroll-lead">
        {t('登録時のニックネームと復旧コードを入力してください。')}
      </p>
      <form
        className="enroll-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await request('/api/recovery/login', {
              nickname,
              recoveryCode: code,
            });
            setCode('');
            await onRestored();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : '再ログインできませんでした。',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t('ニックネーム')}
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            maxLength={40}
            required
          />
        </label>
        <label>
          {t('復旧コード')}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            type="password"
            maxLength={80}
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={t('登録後に控えたコード')}
            required
          />
        </label>
        <p className="form-hint">
          {t(
            'スタンプ履歴と参加IDを引き継ぎます。以前の端末はログアウトされます。新規受付の停止中も再ログインできます。',
          )}
        </p>
        {error && <output className="form-error">{t(error)}</output>}
        <Button type="submit" className="primary-action" disabled={busy}>
          {busy ? t('確認中…') : t('再ログインする')}
        </Button>
      </form>
      <p className="form-hint">
        {t(
          '復旧コードが分からない場合は、元の端末で再発行してください。元の端末も使えない場合は受付へご相談ください。ニックネームだけでのログインはできません。',
        )}
      </p>
    </section>
  );
}
export function RecoverySetup({
  nickname,
  onIssued,
  onLoggedOut,
}: {
  nickname: string | null;
  onIssued: (receipt: RecoveryReceipt) => Promise<void>;
  onLoggedOut: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(nickname ?? ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  return (
    <details className="recovery-support" open={!nickname || undefined}>
      <summary>
        {nickname
          ? t('再ログイン・端末変更に備える')
          : t('ニックネームと復旧コードを設定')}
      </summary>
      <form
        className="enroll-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            if (!nickname) validateNickname(name);
            const receipt = await request('/api/recovery/setup', {
              nickname: name,
            });
            await onIssued(receipt);
            setConfirm(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : '設定できませんでした。');
          } finally {
            setBusy(false);
          }
        }}
      >
        {!nickname && (
          <>
            <label>
              {t('ニックネーム')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={20}
                autoComplete="username"
                required
              />
            </label>
            <p className="form-hint">
              {t(
                '本名は使わず、2〜20文字で入力してください。不適切な名前や管理者を装う名前は使えません。',
              )}
            </p>
          </>
        )}
        <p className="form-hint">
          {nickname
            ? t(
                '新しい復旧コードを発行すると、以前のコードは使えなくなります。ニックネームは変更されません。',
              )
            : t(
                'これまでのスタンプ履歴を残したまま、再ログインの準備をします。',
              )}
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            required
          />
          {nickname
            ? t('以前の復旧コードが無効になることを確認しました')
            : t('ニックネームを登録し、復旧コードを控えます')}
        </label>
        {error && <output className="form-error">{t(error)}</output>}
        <Button type="submit" disabled={busy || !confirm}>
          {busy
            ? t('発行中…')
            : nickname
              ? t('復旧コードを再発行')
              : t('登録して復旧コードを発行')}
        </Button>
      </form>
      {nickname && (
        <Button
          className="logout-action"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                t(
                  'ニックネームと復旧コードを控えていますか？ログアウトしてもスタンプは残ります。',
                ),
              )
            )
              return;
            setBusy(true);
            try {
              await request('/api/logout', {});
              await onLoggedOut();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'ログアウトできませんでした。',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('ログアウト')}
        </Button>
      )}
    </details>
  );
}
export function RecoveryCodeDialog({
  receipt,
  onClose,
}: {
  receipt: RecoveryReceipt | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState('');
  if (!receipt) return null;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="recovery-dialog" showCloseButton={false}>
        <DialogTitle>{t('復旧コードを控えてください')}</DialogTitle>
        <DialogDescription>
          {t(
            '別の端末での再ログインには、ニックネームとこのコードが必要です。このコードは他の人に教えないでください。',
          )}
        </DialogDescription>
        <p>
          {t('ニックネーム：')}
          <strong>{receipt.nickname}</strong>
        </p>
        <code className="recovery-code">{receipt.recoveryCode}</code>
        <p className="form-hint">
          {t(
            'コードをコピーするか、この画面をスクリーンショットで保存してください。閉じると同じコードは再表示できません。',
          )}
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${t('ニックネーム')}: ${receipt.nickname}\n${t('復旧コード')}: ${receipt.recoveryCode}`,
              );
              setCopied(true);
              setError('');
            } catch {
              setError(
                'コピーできませんでした。画面を保存するか、コードを手元に控えてください。',
              );
            }
          }}
        >
          {copied ? t('コピーしました') : t('ニックネームとコードをコピー')}
        </Button>
        {error && <output className="form-error">{t(error)}</output>}
        <label className="check-label">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          {t('ニックネームと復旧コードを控えました')}
        </label>
        <Button className="primary-action" disabled={!saved} onClick={onClose}>
          {t('スタンプ帳へ')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
