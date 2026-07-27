import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { type Locale, type TranslationKey, t as translate } from './i18n';

type I18nContext = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nCtx = createContext<I18nContext | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('th');
  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);

  useEffect(() => {
    SecureStore.getItemAsync('locale').then(saved => {
      if (saved === 'th' || saved === 'en') setLocale(saved);
    });
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    SecureStore.setItemAsync('locale', newLocale);
  }, []);

  return (
    <I18nCtx.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
