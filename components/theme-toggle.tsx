'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/language';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeToggle() {
  const { locale } = useI18n();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('festival-theme');
    } catch {}
    const next: Theme =
      saved === 'dark' || saved === 'light' ? saved : systemTheme();
    // The theme is read from browser storage after hydration to avoid a server/client mismatch.
    // eslint-disable-next-line react/react-compiler
    setTheme(next);
    document.documentElement.dataset.theme = next;

    const sync = (event: StorageEvent) => {
      if (event.key !== 'festival-theme') return;
      const value = event.newValue;
      const nextTheme: Theme =
        value === 'dark' || value === 'light' ? value : systemTheme();
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => {
      let preference: string | null = null;
      try {
        preference = localStorage.getItem('festival-theme');
      } catch {}
      if (preference === 'dark' || preference === 'light') return;
      const nextTheme = systemTheme();
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    };
    window.addEventListener('storage', sync);
    media.addEventListener('change', syncSystem);
    return () => {
      window.removeEventListener('storage', sync);
      media.removeEventListener('change', syncSystem);
    };
  }, []);

  const next = theme === 'dark' ? 'light' : 'dark';
  const label =
    locale === 'en'
      ? next === 'dark'
        ? 'Switch to dark theme'
        : 'Switch to light theme'
      : next === 'dark'
        ? 'ダークテーマに切り替え'
        : 'ライトテーマに切り替え';
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(next);
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('festival-theme', next);
        } catch {}
      }}
    >
      {theme === 'dark' ? (
        <Sun size={20} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Moon size={20} strokeWidth={2} aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
