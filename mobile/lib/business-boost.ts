/**
 * business-boost.ts — Business Boost Service (rewarded ads removed for Play Store prep).
 *
 * The rewarded-ad lifecycle (preload/show) is disabled; the surrounding
 * quota/cooldown logic is preserved. `preloadBoostAd` reports the boost
 * ads as temporarily unavailable so the UI degrades gracefully.
 *
 * Requirements: 2.5, 2.6, 12.1, 12.3, 12.4, 12.5, 12.6
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
  /** Chiama per mostrare l'annuncio (no-op: ads disabilitati) */
  showAd: () => void;
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
 * No-op: rewarded ads were removed for Play Store prep.
 * Reports the boost ads as temporarily unavailable so the UI degrades
 * gracefully (state → 'error' / 'unavailable').
 */
export function preloadBoostAd(options: PreloadOptions): () => void {
  options.onError('Business Boost ads are temporarily unavailable');
  return () => {};
}

export interface ShowAdOptions {
  ad: unknown;
  orgId: string;
  onBoostApplied: () => void;
  onBoostError:   () => void;
  onShowing?:     () => void;
}

/** No-op: rewarded ads disabled. */
export async function showBoostAd(_options: ShowAdOptions): Promise<void> {
  // Rewarded ads removed for Play Store prep.
}
