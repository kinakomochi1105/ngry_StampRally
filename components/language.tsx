'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { translate, detectLocale, type Locale } from '@/lib/i18n';
import { Select } from '@base-ui/react/select';
import { Languages, ChevronDown, Check, MonitorSmartphone } from 'lucide-react';
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
  const { locale, preference, setPreference } = useContext(LanguageContext);
  const current = locale === 'ja' ? '日本語' : 'English';
  const choices = [
    {
      value: 'auto',
      label: '自動 / Auto',
      description:
        locale === 'ja' ? '端末の設定に合わせる' : 'Follow device language',
    },
    { value: 'ja', label: '日本語', description: 'Japanese' },
    { value: 'en', label: 'English', description: '英語' },
  ];
  return (
    <div className="language-select">
      <Select.Root
        value={preference}
        onValueChange={(value) => {
          if (value) setPreference(value);
        }}
        items={choices}
      >
        <Select.Trigger
          className="language-trigger"
          aria-label={'言語を変更 / Change language: ' + current}
        >
          <span className="language-symbol">
            <Languages size={22} aria-hidden="true" />
          </span>
          <span className="language-trigger-label">
            <strong>言語 / Language</strong>
            <small>
              {locale === 'ja' ? 'タップして切り替え' : 'Tap to change'}
            </small>
          </span>
          <span className="language-current">
            {current}
            {preference === 'auto' && (
              <small>{locale === 'ja' ? '自動' : 'Auto'}</small>
            )}
          </span>
          <Select.Icon className="language-chevron">
            <ChevronDown size={18} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            className="language-positioner"
            sideOffset={8}
            align="end"
            alignItemWithTrigger={false}
            collisionPadding={12}
          >
            <Select.Popup className="language-popup">
              <Select.Group>
                <Select.GroupLabel className="language-menu-heading">
                  言語を選択 / Choose language
                </Select.GroupLabel>
                <Select.List>
                  {choices.map((choice) => (
                    <Select.Item
                      key={choice.value}
                      value={choice.value}
                      className="language-option"
                    >
                      <span className="language-option-icon" aria-hidden="true">
                        {choice.value === 'auto' ? (
                          <MonitorSmartphone size={21} />
                        ) : choice.value === 'ja' ? (
                          'あ'
                        ) : (
                          'A'
                        )}
                      </span>
                      <span className="language-option-copy">
                        <Select.ItemText>{choice.label}</Select.ItemText>
                        <small>{choice.description}</small>
                      </span>
                      <Select.ItemIndicator className="language-check">
                        <Check size={20} aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Group>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
