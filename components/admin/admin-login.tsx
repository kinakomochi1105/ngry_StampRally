'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/** The only screen an unauthenticated visitor can reach under /admin. */
export function AdminLogin({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  return (
    <main className="admin-login">
      <div className="admin-top-actions">
        <ThemeToggle />
        <LanguageSelect />
      </div>
      <Link href="/" className="back-link">
        <ChevronLeft size={18} />
        {t('参加者サイトへ')}
      </Link>
      <p className="login-icon">
        <ShieldCheck size={34} aria-hidden="true" />
      </p>
      <p className="eyebrow">FESTIVAL CONTROL</p>
      <h1>{t('管理者ログイン')}</h1>
      <p>{t('参加状況と文化祭の設定を管理します。')}</p>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(password).then(() => setPassword(''));
        }}
      >
        <label>
          {t('管理者パスワード')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <output className="form-error">{t(error)}</output>}
        <Button type="submit" className="primary-action" disabled={busy}>
          {t(busy ? '確認中…' : 'ログイン')}
        </Button>
      </form>
      <small>{t('参加者情報は管理者だけが閲覧できます。')}</small>
    </main>
  );
}
