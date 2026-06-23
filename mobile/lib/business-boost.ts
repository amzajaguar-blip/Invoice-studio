/**
 * business-boost.ts — Business Boost Service V34
 *
 * Gestisce il ciclo completo degli annunci rewarded per il Business Boost:
 *  - Precaricamento annuncio AdMob con timeout 5s
 *  - Daily cap: max 3 rewarded ad per giorno (reset automatico per data)
 *  - Applicazione boost via `applyBoost` dalla rate-limit-engine (RPC atomico)
 *  - Suggestion cooldown 6h (persiste in AsyncStorage, sopravvive a riavvii)
 *
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.9, 2.10, 2.13,
 *               12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 10.8
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { applyBoost } from './rate-limit-engine';

// ─── Costanti compile-time ────────────────────────────────────────────────────

/**
 * ID annuncio rewarded per il Business Boost.
 * Costante compile-time — non sovrascrivibile a runtime (Req 10.8).
 */
export const BOOST_AD_UNIT_ID: string = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-4053625490298263/3442892886';

/** Limite giornaliero rewarded ad (Req 2.5) */
const DAILY_ADS_MAX = 3;

/** Timeout precaricamento annuncio in ms (Req 2.9) */
const PRELOAD_TIMEOUT_MS = 5_000;

/** Durata suggestion cooldown in ms: 6 ore (Req 12.3) */
const SUGGESTION_COOLDOWN_MS = 6 * 60 * 60 * 1_000;

/** Chiave AsyncStorage per il cooldown boost suggestion (Req 12.5) */
export const BOOST_SUGGESTION_COOLDOWN_KEY = 'boost_suggestion_cooldown';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

/**
 * Stato del ciclo di vita dell'annuncio rewarded.
 *
 * - 'idle'        → stato iniziale, annuncio non ancora richiesto
 * - 'loading'     → caricamento in corso
 * - 'ready'       → annuncio caricato e pronto per la visualizzazione
 * - 'showing'     → annuncio in riproduzione
 * - 'error'       → caricamento fallito o errore RPC post-reward
 * - 'unavailable' → daily cap raggiunto (>= 3 oggi) o AdMob non disponibile
 */
export type BoostAdState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'showing'
  | 'error'
  | 'unavailable';

/**
 * Sessione Business Boost — esposta da `useBusinessBoost`.
 */
export interface BoostSession {
  /** Stato corrente dell'annuncio */
  state: BoostAdState;
  /** Messaggio di errore leggibile (se state === 'error' | 'unavailable') */
  errorMsg: string | null;
  /**
   * Chiama per mostrare l'annuncio.
   * @precondition state === 'ready'
   */
  showAd: () => void;
  /** True se il boost è già attivo (TTL 24h non scaduto) */
  boostActive: boolean;
  /** Tempo rimanente al boost, es. "23h 14m"; null se boost non attivo */
  boostExpiresIn: string | null;
  /** Quante visualizzazioni giornaliere restano (3 - dailyAdsWatched) */
  dailyAdsLeft: number;
}

// ─── Tipi interni ─────────────────────────────────────────────────────────────

/** Snapshot del conteggio annunci giornalieri letto da user_plan. */
export interface DailyAdStatus {
  /** Data di riferimento del conteggio (ISO date 'YYYY-MM-DD') */
  daily_ads_date: string;
  /** Quanti annunci sono stati guardati nella data di riferimento */
  daily_ads_watched: number;
}

/** Risultato della valutazione del daily cap. */
export interface DailyCapResult {
  /** True se l'utente può ancora guardare un annuncio oggi */
  canWatch: boolean;
  /** Conteggio effettivo dopo eventuale reset giornaliero */
  effectiveWatched: number;
  /** Quanti annunci restano oggi */
  adsLeft: number;
}

// ─── Funzioni pure di supporto ────────────────────────────────────────────────

/**
 * Valuta il daily cap data la riga `DailyAdStatus` e la data odierna.
 *
 * Algoritmo (Req 2.5, 2.6, 2.7):
 *  1. Se `daily_ads_date < today` → reset: `effectiveWatched = 0`
 *  2. Se `effectiveWatched >= DAILY_ADS_MAX` → `canWatch = false`
 *  3. Altrimenti `canWatch = true`
 */
export function evaluateDailyCap(status: DailyAdStatus, today: string): DailyCapResult {
  const effectiveWatched =
    status.daily_ads_date < today ? 0 : status.daily_ads_watched;

  const canWatch = effectiveWatched < DAILY_ADS_MAX;
  const adsLeft = Math.max(0, DAILY_ADS_MAX - effectiveWatched);

  return { canWatch, effectiveWatched, adsLeft };
}

/**
 * Formatta la differenza tra due Date in "Xh Ym".
 * Usato per `boostExpiresIn` in `BoostSession`.
 */
export function formatTimeRemaining(from: Date, to: Date): string | null {
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) return null;

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Suggestion Cooldown (AsyncStorage) ──────────────────────────────────────

/**
 * Legge il timestamp del suggestion cooldown da AsyncStorage.
 * Restituisce `null` se non presente o non valido.
 *
 * Requirements: 12.5
 */
export async function readSuggestionCooldown(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOST_SUGGESTION_COOLDOWN_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

/**
 * Scrive il timestamp corrente come inizio del suggestion cooldown.
 *
 * Requirements: 12.5, 12.6
 */
export async function writeSuggestionCooldown(timestamp: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOST_SUGGESTION_COOLDOWN_KEY, String(timestamp));
  } catch {
    console.warn('[business-boost] Failed to persist suggestion cooldown');
  }
}

/**
 * Ritorna `true` se il suggestion cooldown è attivo (meno di 6h fa).
 *
 * Requirements: 12.3, 12.4, 12.5
 */
export async function isSuggestionCooldownActive(): Promise<boolean> {
  const cooldownStart = await readSuggestionCooldown();
  if (cooldownStart === null) return false;
  return Date.now() - cooldownStart < SUGGESTION_COOLDOWN_MS;
}

// ─── Algoritmo di precaricamento ──────────────────────────────────────────────

export interface PreloadOptions {
  /** Callback invocata quando l'annuncio è pronto — riceve l'istanza già caricata */
  onReady:       (ad: RewardedAd) => void;
  /** Callback invocata se il caricamento fallisce o scade il timeout */
  onError:       (msg: string) => void;
  /**
   * Callback invocata quando l'utente ottiene il reward.
   * Riceve un callbackId opaco costruito da adUnitId + timestamp.
   */
  onEarnedReward: (callbackId: string) => void;
  /** Callback invocata quando l'annuncio viene chiuso/completato */
  onClosed?:     () => void;
}

/**
 * Precarica un annuncio rewarded per il Business Boost.
 *
 * Algoritmo (da design.md "Algoritmo precaricamento"):
 *  1. Crea `RewardedAd.createForAdRequest(BOOST_AD_UNIT_ID)`
 *  2. Listener LOADED → chiama `onReady`
 *  3. Listener ERROR  → chiama `onError`
 *  4. Timeout 5s: se state non è ancora 'ready', chiama `onError`
 *  5. Avvia `ad.load()`
 *
 * Restituisce una funzione di cleanup (rimuove listener e timeout).
 *
 * Requirements: 2.9, 2.10
 */
export function preloadBoostAd(options: PreloadOptions): () => void {
  const { onReady, onError, onEarnedReward, onClosed } = options;

  let resolved = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const ad = RewardedAd.createForAdRequest(BOOST_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    if (resolved) return;
    resolved = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    onReady(ad);
  });

  const unsubEarned = ad.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    (reward: { type: string; amount: number }) => {
      // AdMob non espone un callbackId nativo lato client.
      // Costruiamo un ID opaco: adUnitId + timestamp + tipo reward.
      // In produzione il vero callbackId arriva via SSV server-side.
      const callbackId = `boost_${BOOST_AD_UNIT_ID}_${Date.now()}_${reward.type}_${reward.amount}`;
      onEarnedReward(callbackId);
    },
  );

  const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error: Error) => {
    if (resolved) return;
    resolved = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    onError(error?.message ?? 'Video non disponibile');
  });

  const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    onClosed?.();
  });

  // Timeout 5s: se lo stato non è ancora 'ready', imposta 'error' (Req 2.9)
  timeoutId = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      onError('Timeout caricamento video (5s)');
    }
  }, PRELOAD_TIMEOUT_MS);

  ad.load();

  // Cleanup: rimuove tutti i listener e cancella il timeout
  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    unsubLoaded();
    unsubEarned();
    unsubError();
    unsubClosed();
  };
}

// ─── showBoostAd ─────────────────────────────────────────────────────────────

export interface ShowAdOptions {
  /** Oggetto `RewardedAd` già caricato (state === 'ready') */
  ad: RewardedAd;
  /** org_id dell'organizzazione corrente */
  orgId: string;
  /** Callback invocata dopo l'applicazione riuscita del boost */
  onBoostApplied: () => void;
  /** Callback invocata se l'RPC fallisce */
  onBoostError:   () => void;
  /** Callback per aggiornare lo stato UI a 'showing' prima di ad.show() */
  onShowing?:     () => void;
}

/**
 * Mostra un annuncio rewarded già caricato e applica il boost al completamento.
 *
 * Flusso:
 *  1. Chiama `onShowing()` per aggiornare lo stato UI → 'showing'
 *  2. Chiama `ad.show()`
 *  3. Su EARNED_REWARD: chiama `applyBoost(orgId, callbackId)` da rate-limit-engine
 *     - Se successo → `onBoostApplied()`
 *     - Se fallisce → `onBoostError()`, nessuna modifica locale (Req 2.13)
 *
 * Note: `ad.show()` è fire-and-forget; il reward arriva via listener già registrato
 * durante il precaricamento. Questa funzione attacca un listener aggiuntivo
 * dedicato all'applicazione RPC.
 *
 * Requirements: 2.1, 2.2, 2.13
 */
export async function showBoostAd(options: ShowAdOptions): Promise<void> {
  const { ad, orgId, onBoostApplied, onBoostError, onShowing } = options;

  onShowing?.();

  // Attach earned reward listener for RPC application.
  // This listener is one-shot: viene rimosso dopo la prima invocazione.
  let earnedUnsub: (() => void) | null = null;

  earnedUnsub = ad.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    (reward: { type: string; amount: number }) => {
      if (earnedUnsub) {
        earnedUnsub();
        earnedUnsub = null;
      }

      const callbackId = `boost_${BOOST_AD_UNIT_ID}_${Date.now()}_${reward.type}_${reward.amount}`;

      // Applica il boost via RPC atomica (Req 2.1, 2.2, 2.13)
      applyBoost(orgId, callbackId)
        .then((success) => {
          if (success) {
            onBoostApplied();
          } else {
            // RPC fallita — nessuna modifica locale, state → 'error'
            onBoostError();
          }
        })
        .catch(() => {
          onBoostError();
        });
    },
  );

  try {
    ad.show();
  } catch (err) {
    // show() può lanciare se l'annuncio è già stato mostrato
    if (earnedUnsub) {
      earnedUnsub();
      earnedUnsub = null;
    }
    onBoostError();
  }
}
