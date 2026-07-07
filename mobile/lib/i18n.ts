import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './locales';
import type { TranslationKeys } from './locales/it';

export const AVAILABLE_LOCALES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
] as const;

export type LocaleCode = (typeof AVAILABLE_LOCALES)[number]['code'];

export type { TranslationKeys };

const SUPPORTED_LOCALES: readonly string[] = AVAILABLE_LOCALES.map((l) => l.code);
const STORAGE_KEY = 'app_locale';

/**
 * DEFAULT_LOCALE è dichiarata come costante stringa primitiva.
 * Viene usata come fallback sicuro in tutti i path — anche se il modulo
 * è valutato parzialmente durante il cold boot di Hermes.
 */
export const DEFAULT_LOCALE: LocaleCode = 'it';

class I18n {
  // Inizializzazione sincrona con valore primitivo — mai undefined nemmeno
  // in Hermes release build dove l'ordine di valutazione dei moduli nativi
  // può variare.
  locale: LocaleCode = DEFAULT_LOCALE;
  defaultLocale: LocaleCode = DEFAULT_LOCALE;
  enableFallback = true;

  t(key: string): string {
    try {
      const safeLocale: LocaleCode = this.locale ?? DEFAULT_LOCALE;
      const bundle = translations[safeLocale as keyof typeof translations];
      if (bundle && key in bundle) {
        return (bundle as Record<string, string>)[key];
      }
      if (this.enableFallback) {
        const fallback = translations[this.defaultLocale as keyof typeof translations]
          ?? translations[DEFAULT_LOCALE];
        if (fallback && key in fallback) {
          return (fallback as Record<string, string>)[key];
        }
      }
    } catch {
      // Mai lanciare da t() — l'app deve restare usabile anche con traduzione mancante.
    }
    return key;
  }
}

/**
 * Istanza singleton dell'engine i18n.
 *
 * Viene costruita a module-evaluation time. In Hermes release, se AsyncStorage
 * non è ancora pronto, il costruttore è comunque sicuro perché non usa AsyncStorage.
 * Il caricamento da storage avviene solo via loadSavedLocale() (chiamata lazily
 * dentro il useEffect di LocaleProvider).
 */
export const i18n: I18n = (() => {
  try {
    return new I18n();
  } catch {
    // Fallback estremo: se per qualsiasi ragione la costruzione fallisce,
    // restituisce un oggetto duck-typed con lo stesso contratto pubblico.
    return {
      locale: DEFAULT_LOCALE,
      defaultLocale: DEFAULT_LOCALE,
      enableFallback: true,
      t: (key: string) => key,
    } as I18n;
  }
})();

export function isLocaleCode(value: string): value is LocaleCode {
  return SUPPORTED_LOCALES.includes(value);
}

export async function loadSavedLocale(): Promise<LocaleCode> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && isLocaleCode(saved)) {
      i18n.locale = saved;
      return saved;
    }
  } catch {
    // Ignore storage errors: keep the synchronous default.
  }
  // Garantisce che locale sia sempre un valore valido dopo il load.
  if (!i18n.locale || !isLocaleCode(i18n.locale)) {
    i18n.locale = DEFAULT_LOCALE;
  }
  return i18n.locale;
}
