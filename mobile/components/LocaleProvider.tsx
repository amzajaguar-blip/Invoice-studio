import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { loadSavedLocale, LocaleCode, AVAILABLE_LOCALES } from '../lib/i18n';

type LocaleContextType = {
  locale: string;
  setLocale: (l: LocaleCode) => Promise<void>;
  t: (key: string, options?: any) => string;
};

export const LocaleContext = createContext<LocaleContextType>({
  locale: 'it',
  setLocale: async () => {},
  t: (key) => key,
});

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [localeState, setLocaleState] = useState(i18n.locale);

  useEffect(() => {
    loadSavedLocale().then(() => setLocaleState(i18n.locale));
  }, []);

  // Stabilizza i riferimenti: evita re-render inutili dei consumer quando
  // capita un \"bridge render\" intermedio. setLocale/t sono stabili tra mount
  // dello stesso provider, cambia solo locale.
  const setLocale = useCallback(async (l: LocaleCode) => {
    const supportedCodes: LocaleCode[] = AVAILABLE_LOCALES.map((loc) => loc.code);
    if (!supportedCodes.includes(l)) {
      throw new Error(`Locale non supportato: ${l}`);
    }
    await AsyncStorage.setItem('app_locale', l);
    i18n.locale = l;
    setLocaleState(l);
  }, []);

  const t = useCallback((key: string, options?: any) => i18n.t(key, options), []);

  const value = useMemo(
    () => ({ locale: localeState, setLocale, t }),
    [localeState, setLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);
