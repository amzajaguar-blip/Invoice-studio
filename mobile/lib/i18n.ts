import { createContext, useContext } from "react";
import { it } from "./locales/it";
import type { TranslationKeys } from "./locales/it";

export const AVAILABLE_LOCALES = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export interface LocaleContextValue {
  locale: string;
  setLocale: (code: string) => Promise<void>;
  t: (key: TranslationKeys) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: "it",
  setLocale: async () => {},
  t: (key) => it[key] ?? key,
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
