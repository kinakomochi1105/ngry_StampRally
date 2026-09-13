'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const labelKey = 'rally-admin-device';

const storedLabel = () => {
  try {
    return localStorage.getItem(labelKey) ?? '';
  } catch {
    return '';
  }
};

/**
 * The only screen an unauthenticated visitor can reach under /admin. The
 * admin password opens the whole console; the reward-desk password opens the
 * desk only. The device name is remembered on this device and written into
 * the operations history beside every change made from it.
 */
export function AdminLogin({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (password: string, label: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState(storedLabel);
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
          try {
            localStorage.setItem(labelKey, label.trim());
          } catch {}
          void onSubmit(password, label.trim()).then(() => setPassword(''));
        }}
      >
        <label>
          {t('端末名（任意）')}
          <input
            value={label}
            maxLength={20}
            autoComplete="off"
            placeholder={t('例：本部PC、受付1')}
            onChange={(e) => setLabel(e.target.value)}
          />
          <small>{t('操作履歴に、誰の端末で行った操作かが残ります。')}</small>
        </label>
        <label>
          {t('管理者または引き換え係のパスワード')}
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
