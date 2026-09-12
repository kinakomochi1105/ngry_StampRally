'use client';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';
import { errorMessage } from '@/lib/client';

/**
 * What a visitor sees when the festival has an access word set and this
 * browser has not given it yet. It stands in for the whole app: nothing about
 * the event — not even the list of locations — is fetched until it is passed.
 */
export function GateScreen({
  onUnlock,
}: {
  onUnlock: (password: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="gate-screen">
      <p className="gate-icon" aria-hidden="true">
        <KeyRound size={30} />
      </p>
      <p className="eyebrow">PRIVATE EVENT</p>
      <h1>{t('合言葉を入力してください')}</h1>
      <p className="gate-lead">
        {t(
          'このスタンプラリーは校内のご案内です。掲示や配布物に書かれている合言葉を入力してください。',
        )}
      </p>
      <form
        className="enroll-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          void onUnlock(password)
            .catch((problem: unknown) =>
              setError(errorMessage(problem, '合言葉を確認できませんでした。')),
            )
            .finally(() => setBusy(false));
        }}
      >
        <label>
          {t('合言葉')}
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            maxLength={64}
            required
          />
        </label>
        {error && <output className="form-error">{t(error)}</output>}
        <Button
          type="submit"
          className="primary-action"
          disabled={busy || password.trim().length === 0}
        >
          {t(busy ? '確認中…' : 'すすむ')}
        </Button>
      </form>
      <small>{t('分からないときは受付の係員にお尋ねください。')}</small>
    </section>
  );
}
