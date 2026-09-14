'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/components/language';

type Theme = 'light' | 'dark';
const storageKey = 'festival-theme';

const stored = () => {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
};

/** Puts the stored choice back on a document React has just replaced. */
export function applyStoredTheme() {
  const value = stored();
  if (value) document.documentElement.dataset.theme = value;
}

const deviceTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * Light/dark, remembered per browser and shared across open tabs.
 *
 * With no stored choice nothing is written to the document: the stylesheet's
 * `prefers-color-scheme` block already follows the device, and leaving the
 * attribute off is what lets it keep following. A choice sets `data-theme`,
 * which wins over that block in both directions. The same value is applied
 * before the first paint by a small script in app/layout.tsx.
 */
export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const apply = () => setTheme(stored() ?? deviceTheme());
    // Read after hydration: the server cannot know the browser's choice.
    // eslint-disable-next-line react/react-compiler
    apply();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const value =
        event.newValue === 'dark' || event.newValue === 'light'
          ? event.newValue
          : null;
      document.documentElement.dataset.theme = value ?? '';
      if (!value) delete document.documentElement.dataset.theme;
      setTheme(value ?? deviceTheme());
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onDevice = () => {
      if (!stored()) setTheme(deviceTheme());
    };
    window.addEventListener('storage', onStorage);
    media.addEventListener('change', onDevice);
    return () => {
      window.removeEventListener('storage', onStorage);
      media.removeEventListener('change', onDevice);
    };
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = t(
    next === 'dark' ? 'ダークテーマに切り替え' : 'ライトテーマに切り替え',
  );
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
          localStorage.setItem(storageKey, next);
        } catch {}
      }}
    >
      {theme === 'dark' ? (
        <Sun size={20} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Moon size={20} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
}
