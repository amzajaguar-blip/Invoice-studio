import React, { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { it } from "@/lib/locales/it";
import { en } from "@/lib/locales/en";
import { es } from "@/lib/locales/es";
import { fr } from "@/lib/locales/fr";
import { de } from "@/lib/locales/de";
import { pt } from "@/lib/locales/pt";
import { zh } from "@/lib/locales/zh";
import { LocaleContext } from "@/lib/i18n";
import type { TranslationKeys } from "@/lib/locales/it";

const STORAGE_KEY = "@invoicestudio/locale";
const TRANSLATIONS: Record<string, typeof it> = { it, en, es, fr, de, pt, zh };

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState("it");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback(async (code: string) => {
    setLocaleState(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback(
    (key: TranslationKeys): string => {
      const dict = TRANSLATIONS[locale] ?? it;
      return (dict as any)[key] ?? it[key] ?? key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
