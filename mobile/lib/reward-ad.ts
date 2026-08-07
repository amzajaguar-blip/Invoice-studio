/**
 * reward-ad.ts — Rewarded ad "documents" per Milo Office.
 *
 * COSA SBLOCCA: +1 documento oltre la quota gratuita lifetime
 * (checkQuota: allowed = total < quota_limit + documents_reward_credits).
 * Mostrato dal QuotaPaywall quando la quota free è esaurita.
 *
 * VINCOLI DI SICUREZZA:
 *  - Il reward è concesso SOLO nella callback EARNED_REWARD, mai in anticipo
 *    (mai al tap sul bottone, mai al LOADED, mai allo show).
 *  - L'accredito effettivo è server-side: Edge Function reward-document-credit
 *    → RPC grant_reward_document (rate limit max 3/giorno per org). Il client
 *    non incrementa mai il contatore localmente (Property 13).
 *  - Utenti Pro: il gate sta nel chiamante (QuotaPaywall usa usePlan;
 *    checkQuota bypassa la quota con entitlement 'pro' attivo). Questo modulo
 *    non conosce lo stato piano e non deve conoscerlo.
 *
 * AdMob:
 *   Ad Unit ID (prod): ca-app-pub-8156953772676654/2433248294 — reward "1 Reward"
 *   In __DEV__ si usa TestIds.REWARDED. Mai l'ID di test in una build release.
 *
 * Lifecycle (mapping dei callback nativi FullScreenContentCallback):
 *   preloadDocumentsRewardAd()  → load() + LOADED (onAdLoaded) /
 *                                 ERROR (onAdFailedToLoad)
 *   showDocumentsRewardAd()     → show() solo se pronto + online
 *   AdEventType.CLOSED          → onAdDismissedFullScreenContent:
 *                                 precarica il prossimo ad
 *   show() rejection            → onAdFailedToShowFullScreenContent:
 *                                 cleanup + precarica un ad nuovo
 */

import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import NetInfo from '@react-native-community/netinfo';
import { initAds } from './ads';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Rewarded "documents" Ad Unit ID (production). */
export const REWARDED_DOCUMENTS_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-8156953772676654/2433248294';

/** Timeout di caricamento oltre il quale l'ad è dichiarato non disponibile (ms). */
const REWARD_AD_LOAD_TIMEOUT_MS = 10_000;

// ─── State ───────────────────────────────────────────────────────────────────

let rewardAd: RewardedAd | null = null;
let rewardAdReady = false;
let rewardAdLoading = false;
/** Resolver in attesa sull'esito del preload in corso (UI in "Caricamento…"). */
let pendingResolvers: ((ready: boolean) => void)[] = [];

// ─── Preload ─────────────────────────────────────────────────────────────────

/**
 * Precarica il rewarded "documents". Chiamare quando il paywall quota diventa
 * visibile (non all'avvio app — evita richieste ad sprecate per utenti che
 * non raggiungono mai la quota).
 *
 * @returns true quando l'ad è caricato (onAdLoaded); false se il caricamento
 *          fallisce (onAdFailedToLoad), scade il timeout, o il device è
 *          offline. Mai throw — il chiamante mostra il fallback UX su false.
 */
export async function preloadDocumentsRewardAd(): Promise<boolean> {
  if (rewardAdReady && rewardAd) return true;

  // Preload già in corso: ci si accoda allo stesso esito.
  if (rewardAdLoading) {
    return new Promise<boolean>((resolve) => {
      pendingResolvers.push(resolve);
    });
  }

  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;
  } catch {
    return false;
  }

  // Garantisce SDK inizializzato + consenso UMP risolto (idempotente).
  await initAds();

  rewardAdLoading = true;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settleAll = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      rewardAdLoading = false;
      const resolvers = pendingResolvers;
      pendingResolvers = [];
      resolvers.forEach((r) => r(ready));
    };

    // Safety timeout — nessun evento dall'SDK entro il limite: ad dichiarato
    // non disponibile (fill rate basso, rete lenta, stato "In preparazione").
    const timeoutHandle = setTimeout(() => {
      rewardAd = null;
      rewardAdReady = false;
      settleAll(false);
    }, REWARD_AD_LOAD_TIMEOUT_MS);

    try {
      const ad = RewardedAd.createForAdRequest(REWARDED_DOCUMENTS_AD_UNIT_ID, {
        // Consenso gestito da UMP in initAds — coerente con ads.ts.
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        unsubLoaded();
        unsubError();
        // Timeout già scattato: l'ad arrivato in ritardo viene scartato.
        if (settled) return;
        rewardAd = ad;
        rewardAdReady = true;
        settleAll(true);
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
        unsubLoaded();
        unsubError();
        rewardAd = null;
        rewardAdReady = false;
        console.warn('[reward-ad] documents rewarded failed to load', error);
        settleAll(false);
      });

      ad.load();
    } catch (err) {
      console.warn('[reward-ad] preload setup failed', err);
      settleAll(false);
    }
  });
}

// ─── Show ────────────────────────────────────────────────────────────────────

/**
 * Mostra il rewarded precaricato.
 *
 * @param onEarned invocato SOLO dalla callback EARNED_REWARD dell'SDK — cioè
 *        a video effettivamente completato. È l'unico punto in cui il
 *        chiamante può avviare l'accredito server-side del documento.
 * @returns true se l'ad è stato aperto, false se non pronto, offline o
 *          fallito. Su CLOSED o fallimento precarica il prossimo ad.
 *          Mai throw — il flusso documenti deve continuare comunque.
 */
export async function showDocumentsRewardAd(onEarned: () => void): Promise<boolean> {
  if (!rewardAdReady || !rewardAd) return false;

  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;
  } catch {
    return false;
  }

  // Detach dallo state del modulo prima dello show — un'istanza mostrata non
  // è riutilizzabile, lo slot è liberato a prescindere dall'esito.
  const ad = rewardAd;
  rewardAd = null;
  rewardAdReady = false;

  const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    // L'SDK espone solo { type, amount } — il token SSV non esiste nel JS
    // layer. L'accredito passa dal server (Edge Function + rate limit RPC).
    onEarned();
  });

  const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    unsubEarned();
    unsubClosed();
    // onAdDismissedFullScreenContent equivalente: precarica il prossimo ad.
    void preloadDocumentsRewardAd();
  });

  try {
    await ad.show();
    return true;
  } catch (err) {
    // onAdFailedToShowFullScreenContent equivalente.
    unsubEarned();
    unsubClosed();
    console.warn('[reward-ad] documents rewarded failed to show', err);
    void preloadDocumentsRewardAd();
    return false;
  }
}
