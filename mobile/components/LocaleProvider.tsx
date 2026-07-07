import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n, loadSavedLocale, type LocaleCode, AVAILABLE_LOCALES, DEFAULT_LOCALE } from '../lib/i18n';

// Re-export per compatibilità con eventuali import esterni
export { DEFAULT_LOCALE };

const STORAGE_KEY = 'app_locale';

type LocaleContextType = {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => Promise<void>;
  t: (key: string) => string;
};

export const LocaleContext = createContext<LocaleContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: async () => {},
  t: (key) => key,
});

/**
 * getSafeLocale — lettura difensiva di i18n.locale.
 *
 * Tre livelli di protezione:
 * 1. i18n potrebbe essere undefined se il modulo è stato valutato parzialmente
 *    da Hermes prima che tutti i moduli nativi fossero pronti (cold boot release).
 * 2. i18n.locale potrebbe essere undefined/null se l'istanza è stata creata
 *    ma il campo non inizializzato.
 * 3. Il valore potrebbe non essere un LocaleCode valido.
 *
 * In tutti i casi restituisce DEFAULT_LOCALE ('it') che è una stringa primitiva
 * mai undefined.
 */
function getSafeLocale(): LocaleCode {
  try {
    // Accesso doppiamente guardato: prima sull'oggetto, poi sul campo
    const loc = (i18n as I18nLike | null | undefined)?.locale;
    if (typeof loc === 'string' && loc.length > 0) {
      return loc as LocaleCode;
    }
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Tipo minimo per il guard — non importiamo la classe privata
type I18nLike = { locale?: string | null };

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  // eslint-disable-next-line no-console
  console.log('[LocaleProvider] mount — i18n:', typeof i18n, i18n?.locale);

  const [localeState, setLocaleState] = useState<LocaleCode>(() => {
    const initial = getSafeLocale();
    // eslint-disable-next-line no-console
    console.log('[LocaleProvider] initial locale state:', initial);
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    loadSavedLocale()
      .then(() => {
        if (!cancelled) {
          const loaded = getSafeLocale();
          // eslint-disable-next-line no-console
          console.log('[LocaleProvider] loadSavedLocale resolved:', loaded);
          setLocaleState(loaded);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[LocaleProvider] loadSavedLocale error (non-fatal):', err);
      });
    return () => { cancelled = true; };
  }, []);

  const setLocale = useCallback((l: LocaleCode) => {
    const supportedCodes: LocaleCode[] = AVAILABLE_LOCALES.map((loc) => loc.code);
    if (!supportedCodes.includes(l)) {
      throw new Error(`Locale non supportato: ${l}`);
    }
    return (async () => {
      await AsyncStorage.setItem(STORAGE_KEY, l);
      i18n.locale = l;
      setLocaleState(l);
    })();
  }, []);

  const t = useCallback((key: string): string => {
    try {
      return i18n?.t(key) ?? key;
    } catch {
      return key;
    }
  }, []);

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
