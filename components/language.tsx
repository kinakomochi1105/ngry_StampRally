'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { translate, detectLocale, type Locale } from '@/lib/i18n';
const LanguageContext = createContext<{
  locale: Locale;
  preference: string;
  setPreference: (value: string) => void;
}>({ locale: 'ja', preference: 'auto', setPreference: () => {} });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState('auto');
  const [system, setSystem] = useState<Locale>('ja');
  useEffect(() => {
    const refresh = () => {
      setSystem(detectLocale(navigator.languages));
      try {
        const value = localStorage.getItem('festival-language');
        setPreferenceState(value === 'ja' || value === 'en' ? value : 'auto');
      } catch {}
    };
    refresh();
    window.addEventListener('languagechange', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('languagechange', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const locale =
    preference === 'ja' || preference === 'en' ? preference : system;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setPreference = (value: string) => {
    const next = value === 'ja' || value === 'en' ? value : 'auto';
    setPreferenceState(next);
    try {
      localStorage.setItem('festival-language', next);
    } catch {}
  };
  return (
    <LanguageContext.Provider value={{ locale, preference, setPreference }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useI18n() {
  const { locale } = useContext(LanguageContext);
  const t = useCallback((text: string) => translate(text, locale), [locale]);
  return { locale, t };
}
export function LanguageSelect() {
  const { preference, setPreference } = useContext(LanguageContext);
  return (
    <label className="language-select">
      <span>Language / 言語</span>
      <select
        aria-label="Language / 言語"
        value={preference}
        onChange={(e) => setPreference(e.target.value)}
      >
        <option value="auto">自動 / Auto</option>
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
