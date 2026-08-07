/**
 * useDocumentAd — Hook per pubblicità sulla generazione documenti.
 *
 * Logica:
 *  - Utente FREE:     genera il documento PRIMA, poi mostra l'interstitial
 *                     "generate" precaricato (se pronto). Mai durante
 *                     un'operazione async in corso: generateFn() è già
 *                     completata quando l'ad parte. Se l'ad non è pronto
 *                     (offline, no fill, throttle 60s) si salta senza
 *                     attendere — il flusso non si blocca mai.
 *  - Utente PREMIUM:  nessuna pubblicità, solo generazione.
 *
 * L'interstitial usa l'Ad Unit ID di produzione già configurato in ads.ts
 * (precaricato via preloadGenerateInterstitial, kick automatico in initAds).
 * Non si usa rewarded ad qui — è un interstitial standard.
 *
 * Lo stato Pro viene letto da PlanContext (usePlan), NON da una chiamata
 * diretta a Purchases.getCustomerInfo(): PlanContext è già la source of
 * truth condivisa con BannerAdWrapper/QuotaPaywall, con retry e stato
 * "isLoading" tracciato. Interrogare RevenueCat qui in autonomia creava
 * una race indipendente (isPremium locale sempre inizializzato a false) e
 * un fail-open silenzioso: un errore di rete su getCustomerInfo() faceva
 * trattare come "free" anche un utente Pro, mostrandogli l'interstitial.
 *
 * Uso:
 *   const { runWithAd, adLoading } = useDocumentAd();
 *   await runWithAd(async () => { /* genera il documento *\/ });
 */

import { useCallback, useRef, useState } from "react";
import { usePlan } from "@/context/PlanContext";
import { showGenerateInterstitialIfReady } from "./ads";

export interface UseDocumentAdResult {
  /**
   * Wrappa la funzione di generazione documento con la logica ads.
   * - Esegue SEMPRE prima `generateFn` (la generazione non è mai bloccata
   *   né ritardata dall'ad).
   * - Dopo la generazione: se premium → fine. Se free → mostra
   *   l'interstitial precaricato se disponibile, altrimenti skip silenzioso.
   */
  runWithAd: (generateFn: () => Promise<void>) => Promise<void>;
  /** True mentre l'interstitial post-generazione è in visualizzazione. */
  adLoading: boolean;
}

export function useDocumentAd(): UseDocumentAdResult {
  const { isPremium, limits } = usePlan();
  const [adLoading, setAdLoading] = useState(false);
  // Previene doppia chiamata concorrente
  const runningRef = useRef(false);

  const runWithAd = useCallback(async (generateFn: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      // 1. Genera il documento PRIMA — mai mostrare un ad mentre
      //    un'operazione async è in corso.
      await generateFn();

      // 2. Utente Pro riconosciuto SOLO quando PlanContext ha già risolto
      //    il piano (limits.isLoading === false): durante il caricamento
      //    isPremium di default è false, quindi va trattato come "non ancora
      //    determinato", non come "free" — altrimenti un Pro appena aperto
      //    l'app vedrebbe l'interstitial prima che RevenueCat risponda.
      if (limits.isLoading) return;

      if (!isPremium) {
        // 3. Utente free: mostra l'interstitial precaricato SE pronto.
        //    Ritorna subito false se non caricato / offline / throttled —
        //    il flusso post-generazione non attende mai l'ad.
        setAdLoading(true);
        try {
          await showGenerateInterstitialIfReady();
        } catch {
          // Errore ad — non blocca mai il flusso post-generazione
        } finally {
          setAdLoading(false);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [isPremium, limits.isLoading]);

  return { runWithAd, adLoading };
}
