/**
 * i18n-dev-check — Sincronizzazione chiavi tra file locali.
 *
 * Confronta l'elenco delle chiavi di it.ts (lingua master) con quello
 * di ciascuno degli altri 6 file locale. Se in una lingua manca una
 * chiave presente in it.ts, stampa un console.warn.
 *
 * Attivo SOLO in modalità sviluppo (flag __DEV__ di React Native).
 * Non gira MAI in produzione. Non blocca l'app, non lancia errori.
 *
 * Da richiamare una sola volta all'avvio dell'app (es. dal file
 * dove viene montato il <LocaleProvider>).
 */

import { it } from "./locales/it";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { pt } from "./locales/pt";
import { zh } from "./locales/zh";

let alreadyChecked = false;

export function runI18nDevCheck(): void {
  if (!__DEV__) return;
  if (alreadyChecked) return;
  alreadyChecked = true;

  try {
    const masterKeys = Object.keys(it) as Array<keyof typeof it>;

    const locales: Array<{ code: string; dict: Record<string, unknown> }> = [
      { code: "en", dict: en },
      { code: "es", dict: es },
      { code: "fr", dict: fr },
      { code: "de", dict: de },
      { code: "pt", dict: pt },
      { code: "zh", dict: zh },
    ];

    for (const { code, dict } of locales) {
      for (const key of masterKeys) {
        if (!(key in dict)) {
          console.warn(`[i18n check] lingua "${code}" — chiave mancante: "${key}"`);
        }
      }
    }
  } catch {
    // non bloccare l'app in nessun caso
  }
}
