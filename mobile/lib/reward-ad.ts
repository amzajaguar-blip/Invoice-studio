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
 *   L'ad unit in uso lo sceglie USE_TEST_ADS qui sotto: finche' l'account
 *   AdMob non e' approvato gli ID di produzione rispondono sempre NO_FILL.
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
} from 'react-native-google-mobile-ads';
import NetInfo from '@react-native-community/netinfo';
import { initAds } from './ads';
import { describeAdError } from './ads-diag';
import { supabase } from '@/lib/supabase';

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Interruttore fra ID di test e ID reale.
 *
 * `true` finche' l'account AdMob non e' approvato: gli ad unit di produzione
 * rispondono NO_FILL a ogni richiesta, quindi il video premio risulterebbe
 * sempre non disponibile pur essendo il codice corretto. Gli ID di test di
 * Google hanno fill garantito e non dipendono dallo stato del nostro account.
 *
 * Per tornare in produzione basta portarlo a `false`: nient'altro da cambiare.
 */
const USE_TEST_ADS = true;

/**
 * Ad unit rewarded ufficiale di test di Google per Android.
 *
 * E' una costante pubblica documentata, non un segreto, e serve annunci di
 * test sempre — anche mentre un account e' in revisione.
 */
const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

/**
 * Ad unit rewarded reale — reward "1 Reward" sul nostro account AdMob.
 *
 * TODO: riattivare quando l'account AdMob sarà approvato
 */
const REAL_REWARDED_AD_UNIT_ID = 'ca-app-pub-8156953772676654/2433248294';

/** Rewarded "documents" Ad Unit ID effettivamente usato da questa build. */
export const REWARDED_DOCUMENTS_AD_UNIT_ID = USE_TEST_ADS
  ? TEST_REWARDED_AD_UNIT_ID
  : REAL_REWARDED_AD_UNIT_ID;

/** Timeout di caricamento oltre il quale l'ad è dichiarato non disponibile (ms). */
const REWARD_AD_LOAD_TIMEOUT_MS = 10_000;

// ─── State ───────────────────────────────────────────────────────────────────

let rewardAd: RewardedAd | null = null;
let rewardAdReady = false;
let rewardAdLoading = false;
/** Resolver in attesa sull'esito del preload in corso (UI in "Caricamento…"). */
let pendingResolvers: ((ready: boolean) => void)[] = [];
/** Dettaglio dell'ultimo fallimento di caricamento, per i log. */
let lastLoadError: string | null = null;

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

  // L'executor e' async perche' l'identita' per l'SSV va letta dalla sessione
  // Supabase prima di costruire la richiesta. Gli errori sono gia' catturati
  // dal try/catch interno, quindi nessuna promise resta appesa.
  return new Promise<boolean>(async (resolve) => {
    // Il chiamante che avvia il preload si accoda come gli altri: settleAll()
    // risolve solo pendingResolvers, quindi senza questa push la promise
    // restituita a chi ha iniziato il caricamento non si risolverebbe mai.
    pendingResolvers.push(resolve);

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
      // Server-Side Verification: senza questo blocco AdMob chiama la
      // callback SSV senza sapere a chi accreditare il reward, e la edge
      // function reward-document-credit scarta la richiesta perche' le manca
      // user_id. Il credito lato server non arrivava mai — l'utente vedeva il
      // video e non riceveva nulla.
      //
      // La edge function legge dai query param: user_id (UUID Supabase auth) e
      // custom_data (org_id). Vanno impostati PRIMA di ad.load(): dopo il
      // caricamento la richiesta e' gia' partita.
      const ssv = await getRewardSsvIdentity();

      const ad = RewardedAd.createForAdRequest(REWARDED_DOCUMENTS_AD_UNIT_ID, {
        // Consenso gestito da UMP in initAds — coerente con ads.ts.
        requestNonPersonalizedAdsOnly: false,
        ...(ssv
          ? {
              serverSideVerificationOptions: {
                userId: ssv.userId,
                customData: ssv.orgId ?? '',
              },
            }
          : {}),
      });

      if (!ssv) {
        // Senza sessione non c'e' nessuno da accreditare: si carica comunque
        // l'annuncio, ma il reward restera' solo locale.
        console.warn('[reward-ad] nessuna sessione: SSV non agganciata');
      }

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
        // Il dettaglio finisce nei log, non a schermo: all'utente basta
        // sapere che il video non e' disponibile, mentre il codice d'errore
        // serve a chi sviluppa per distinguere NO_FILL da unit rifiutata.
        lastLoadError = describeAdError(error);
        console.warn('[reward-ad] documents rewarded failed to load', lastLoadError);
        settleAll(false);
      });

      ad.load();
    } catch (err) {
      console.warn('[reward-ad] preload setup failed', err);
      settleAll(false);
    }
  });
}

/**
 * Identita' da passare ad AdMob per la Server-Side Verification.
 *
 * `userId` e' l'UUID dell'utente Supabase, `orgId` finisce in `custom_data`.
 * Sono esattamente i due campi che la edge function reward-document-credit
 * legge dai query param della callback.
 */
async function getRewardSsvIdentity(): Promise<{ userId: string; orgId?: string } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;
    const orgId =
      (session.user.user_metadata?.org_id as string | undefined) ??
      (session.user.app_metadata?.org_id as string | undefined);
    return { userId, orgId };
  } catch (err) {
    console.warn('[reward-ad] impossibile leggere la sessione per l\'SSV', err);
    return null;
  }
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
