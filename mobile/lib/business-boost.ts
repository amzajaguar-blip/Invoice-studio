/**
 * business-boost.ts — Business Boost Service.
 *
 * Il ciclo di vita dell'annuncio rewarded era stato disattivato in
 * preparazione della pubblicazione sullo store e mai riacceso: `preloadBoostAd`
 * riportava sempre "non disponibile" e il Business Boost risultava rotto
 * qualunque cosa si configurasse su AdMob. Ora delega a `lib/reward-ad.ts`,
 * che e' l'implementazione viva ed e' agganciata alla Server-Side
 * Verification — quindi il credito arriva anche al backend, non solo alla UI.
 * La logica di quota e cooldown attorno e' rimasta invariata.
 *
 * Requirements: 2.5, 2.6, 12.1, 12.3, 12.4, 12.5, 12.6
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  preloadDocumentsRewardAd,
  showDocumentsRewardAd,
  getLastRewardAdError,
} from './reward-ad';
import { ADS_DIAG } from './ads-diag';

// ─── Costanti compile-time ────────────────────────────────────────────────────

/** Limite giornaliero rewarded ad (Req 2.5) */
const DAILY_ADS_MAX = 3;

/** Durata suggestion cooldown in ms: 6 ore (Req 12.3) */
const SUGGESTION_COOLDOWN_MS = 6 * 60 * 60 * 1_000;

/** Chiave AsyncStorage per il cooldown boost suggestion (Req 12.5) */
export const BOOST_SUGGESTION_COOLDOWN_KEY = 'boost_suggestion_cooldown';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

/**
 * Stato del ciclo di vita dell'annuncio rewarded.
 *  - 'unavailable' → daily cap raggiunto o ads non disponibili
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
  /** Chiama per mostrare l'annuncio rewarded */
  showAd: () => void;
  /**
   * Riavvia il caricamento dopo un errore.
   *
   * Serve un'azione distinta da `showAd`: quest'ultima esce subito se lo stato
   * non e' 'ready', quindi in stato 'error' — l'unico in cui il bottone
   * "Riprova" e' a schermo — non poteva fare nulla per costruzione.
   */
  retryAd: () => void;
  /** True se il boost è già attivo (TTL 24h non scaduto) */
  boostActive: boolean;
  /** Tempo rimanente al boost, es. "23h 14m"; null se boost non attivo */
  boostExpiresIn: string | null;
  /** Quante visualizzazioni giornaliere restano */
  dailyAdsLeft: number;
}

// ─── Tipi interni ─────────────────────────────────────────────────────────────

/** Snapshot del conteggio annunci giornalieri letto da user_plan. */
export interface DailyAdStatus {
  daily_ads_date: string;
  daily_ads_watched: number;
}

/** Risultato della valutazione del daily cap. */
export interface DailyCapResult {
  canWatch: boolean;
  effectiveWatched: number;
  adsLeft: number;
}

// ─── Funzioni pure di supporto ────────────────────────────────────────────────

export function evaluateDailyCap(status: DailyAdStatus, today: string): DailyCapResult {
  const effectiveWatched =
    status.daily_ads_date < today ? 0 : status.daily_ads_watched;

  const canWatch = effectiveWatched < DAILY_ADS_MAX;
  const adsLeft = Math.max(0, DAILY_ADS_MAX - effectiveWatched);

  return { canWatch, effectiveWatched, adsLeft };
}

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

export async function writeSuggestionCooldown(timestamp: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOST_SUGGESTION_COOLDOWN_KEY, String(timestamp));
  } catch {
    console.warn('[business-boost] Failed to persist suggestion cooldown');
  }
}

export async function isSuggestionCooldownActive(): Promise<boolean> {
  const cooldownStart = await readSuggestionCooldown();
  if (cooldownStart === null) return false;
  return Date.now() - cooldownStart < SUGGESTION_COOLDOWN_MS;
}

// ─── Preload / Show (rewarded ads disabled) ──────────────────────────────────

export interface PreloadOptions {
  onReady:       (ad: unknown) => void;
  onError:       (msg: string) => void;
  onEarnedReward: (callbackId: string) => void;
  onClosed?:     () => void;
}

/**
 * Chiave i18n usata quando l'annuncio non e' caricabile (fill rate nullo,
 * rete assente, cap giornaliero).
 *
 * E' una CHIAVE, non una frase: prima qui c'era una stringa inglese scritta a
 * mano che non passava da nessuna traduzione e arrivava cosi' com'era
 * all'utente. Chi consuma `onError` deve risolverla con `t()`.
 */
export const BOOST_UNAVAILABLE_KEY = 'boost_unavailable_video_hint';

/**
 * Precarica l'annuncio rewarded del Business Boost.
 *
 * Ritorna una funzione di annullamento: se il componente si smonta prima che
 * il caricamento finisca, i callback non vengono piu' invocati.
 */
export function preloadBoostAd(options: PreloadOptions): () => void {
  let cancelled = false;

  // Con la diagnostica accesa l'errore mostrato e' quello vero dell'SDK, non la
  // frase generica: e' cio' che distingue "AdMob non ha annunci" da "ad unit ID
  // rifiutato", due cause che a schermo si assomigliano e si risolvono in modi
  // opposti. Senza diagnostica resta la chiave i18n, che e' quanto deve vedere
  // un utente vero.
  const failureMessage = () =>
    ADS_DIAG
      ? `[ads] rewarded non caricato · ${getLastRewardAdError() ?? 'nessun dettaglio dall\'SDK'}`
      : BOOST_UNAVAILABLE_KEY;

  void preloadDocumentsRewardAd()
    .then((ready) => {
      if (cancelled) return;
      if (ready) options.onReady({});
      else options.onError(failureMessage());
    })
    .catch(() => {
      if (!cancelled) options.onError(failureMessage());
    });

  return () => {
    cancelled = true;
  };
}

export interface ShowAdOptions {
  ad: unknown;
  onBoostApplied: () => void;
  onBoostError:   () => void;
  onShowing?:     () => void;
}

/**
 * Mostra l'annuncio rewarded e applica il boost solo a reward guadagnato.
 *
 * `onBoostApplied` scatta sull'evento EARNED_REWARD dell'SDK, non alla
 * chiusura dell'annuncio: chi chiude il video prima della fine non ottiene
 * nulla. Il credito lato server arriva per conto suo via callback SSV.
 *
 * Qui NON si passa piu' un `orgId`. Non e' mai stato usato da questa funzione,
 * ma il chiamante lo pretendeva prima di procedere e usciva in silenzio quando
 * mancava: il risultato era un bottone "Guarda video" che non reagiva al tap.
 * L'org a cui accreditare il reward la risolve `getRewardSsvIdentity()` in
 * reward-ad.ts leggendo la sessione Supabase, che e' la fonte giusta perche' e'
 * la stessa che AdMob rimanda al server nella callback SSV.
 */
export async function showBoostAd(options: ShowAdOptions): Promise<void> {
  options.onShowing?.();
  try {
    const shown = await showDocumentsRewardAd(() => {
      options.onBoostApplied();
    });
    if (!shown) options.onBoostError();
  } catch (err) {
    console.warn('[business-boost] showBoostAd fallita', err);
    options.onBoostError();
  }
}
