/**
 * rate-limit-engine.ts — Nucleo del sistema freemium V34
 *
 * Centralizza tutta la logica di limite, boost e piano.
 * Legge `user_plan` da Supabase, gestisce la cache AsyncStorage per UX offline,
 * e fornisce funzioni pure per il controllo dei limiti.
 *
 * Requirements: 1.1–1.8, 2.1–2.13, 3.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

export type ResourceType = 'invoice' | 'customer' | 'quote';

export type PlanTier = 'free' | 'premium';

export interface PlanLimits {
  invoices:  { base: number; boost: number; used: number; canCreate: boolean };
  customers: { base: number; boost: number; used: number; canCreate: boolean };
  quotes:    { base: number; boost: number; used: number; canCreate: boolean };
  plan:          PlanTier;
  boostActive:   boolean;
  boostExpiresAt: Date | null;
  dailyAdsWatched: number;
  dailyAdsMax:   number; // sempre 3
  isLoading:     boolean;
}

export interface CheckLimitResult {
  allowed:   boolean;
  reason?:   'limit_reached' | 'boost_available' | 'premium_required';
  remaining: number;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const DAILY_ADS_MAX = 3;

/** Validità cache: 24 ore in millisecondi */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_KEY_PREFIX = 'plan_limits_';

interface CachedPlanLimits {
  data:      PlanLimits;
  cachedAt:  number; // timestamp ms
}

// ─── Helper interni ───────────────────────────────────────────────────────────

function cacheKey(orgId: string): string {
  return `${CACHE_KEY_PREFIX}${orgId}`;
}

async function readCache(orgId: string): Promise<CachedPlanLimits | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(orgId));
    if (!raw) return null;
    const parsed: CachedPlanLimits = JSON.parse(raw);
    // Ripristina Date da JSON string
    if (parsed.data.boostExpiresAt) {
      parsed.data.boostExpiresAt = new Date(parsed.data.boostExpiresAt);
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(orgId: string, limits: PlanLimits): Promise<void> {
  try {
    const payload: CachedPlanLimits = {
      data: limits,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey(orgId), JSON.stringify(payload));
  } catch {
    // Cache write failure non è fatale
  }
}

/**
 * Fallback offline con tutti canCreate: false.
 * Usato quando Supabase fallisce e non esiste cache.
 */
function buildErrorLimits(): PlanLimits {
  return {
    invoices:  { base: 5, boost: 0, used: 0, canCreate: false },
    customers: { base: 3, boost: 0, used: 0, canCreate: false },
    quotes:    { base: 3, boost: 0, used: 0, canCreate: false },
    plan:          'free',
    boostActive:   false,
    boostExpiresAt: null,
    dailyAdsWatched: 0,
    dailyAdsMax:   DAILY_ADS_MAX,
    isLoading:     false,
  };
}

/**
 * Calcola `canCreate` per una risorsa data il piano.
 */
function computeCanCreate(
  isPremium: boolean,
  boostActive: boolean,
  base: number,
  boost: number,
  used: number,
): boolean {
  if (isPremium) return true;
  const effectiveLimit = boostActive ? base + boost : base;
  return used < effectiveLimit;
}

// ─── maybeResetMonthlyCounters ────────────────────────────────────────────────

/**
 * Resetta i contatori mensili se `period_start` è precedente all'inizio del mese corrente.
 * Eseguita lato server via UPDATE condizionale.
 *
 * Requirements: 1.5
 */
export async function maybeResetMonthlyCounters(orgId: string): Promise<void> {
  try {
    // Calcolo lato client: inizio mese corrente come DATE stringa 'YYYY-MM-DD'
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString().slice(0, 10);

    const { error } = await supabase
      .from('user_plan')
      .update({
        invoices_used:  0,
        customers_used: 0,
        quotes_used:    0,
        period_start:   firstOfMonthStr,
      })
      .eq('org_id', orgId)
      .lt('period_start', firstOfMonthStr);

    if (error) {
      console.warn('[rate-limit-engine] maybeResetMonthlyCounters failed:', error.message);
    }
  } catch (err) {
    console.warn('[rate-limit-engine] maybeResetMonthlyCounters exception:', err);
  }
}

// ─── fetchPlanLimits ──────────────────────────────────────────────────────────

/**
 * Legge i limiti dell'organizzazione da Supabase (tabella `user_plan`).
 *
 * @precondition orgId è un UUID valido di un'organizzazione esistente
 * @postcondition
 *   - Se plan === 'premium': tutti i canCreate === true
 *   - Se plan === 'free' e boost scaduto: canCreate[r] = used[r] < base[r]
 *   - Se plan === 'free' e boost attivo: canCreate[r] = used[r] < base[r] + boost[r]
 *   - boostActive === (boostExpiresAt !== null && boostExpiresAt > now)
 *   - dailyAdsWatched >= 0 && dailyAdsWatched <= 3
 * @sideEffects
 *   - Chiama maybeResetMonthlyCounters se period_start < inizio mese
 *   - Scrive la cache AsyncStorage in caso di successo
 *   - Mostra toast "Dati offline" (3s) se ritorna da cache per errore Supabase
 *   - Ritorna tutti canCreate: false se nessuna cache disponibile in caso di errore
 *
 * Requirements: 1.1–1.8, 2.1–2.4, 3.1
 */
export async function fetchPlanLimits(
  orgId: string,
  options?: {
    /** Callback per mostrare il toast "Dati offline" (3s) */
    onOfflineToast?: () => void;
    /** Callback per mostrare errore bloccante (nessuna cache) */
    onBlockingError?: () => void;
  },
): Promise<PlanLimits> {
  try {
    const { data: row, error } = await supabase
      .from('user_plan')
      .select(`
        plan,
        invoices_limit,
        customers_limit,
        quotes_limit,
        invoices_used,
        customers_used,
        quotes_used,
        period_start,
        boost_invoices_extra,
        boost_customers_extra,
        boost_quotes_extra,
        boost_expires_at,
        daily_ads_watched,
        daily_ads_date
      `)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !row) {
      throw new Error(error?.message ?? 'Nessuna riga user_plan trovata');
    }

    // ── Reset mensile se necessario ─────────────────────────────────────────
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString().slice(0, 10);

    if (row.period_start < firstOfMonthStr) {
      // Fire-and-forget il reset, poi usa i dati aggiornati localmente
      maybeResetMonthlyCounters(orgId).catch(() => {});
      // Aggiorna i valori locali per questa chiamata
      row.invoices_used  = 0;
      row.customers_used = 0;
      row.quotes_used    = 0;
      row.period_start   = firstOfMonthStr;
    }

    // ── Calcolo boostActive ────────────────────────────────────────────────
    let boostExpiresAt: Date | null = null;
    if (row.boost_expires_at) {
      boostExpiresAt = new Date(row.boost_expires_at);
    }
    const boostActive = boostExpiresAt !== null && boostExpiresAt > now;

    // ── Reset giornaliero ads watched ──────────────────────────────────────
    const today = now.toISOString().slice(0, 10);
    const dailyAdsWatched =
      row.daily_ads_date < today ? 0 : (row.daily_ads_watched ?? 0);

    const isPremium = row.plan === 'premium';

    // ── Costruzione PlanLimits ─────────────────────────────────────────────
    const limits: PlanLimits = {
      invoices: {
        base:      row.invoices_limit  ?? 5,
        boost:     boostActive ? (row.boost_invoices_extra ?? 0) : 0,
        used:      row.invoices_used   ?? 0,
        canCreate: computeCanCreate(
          isPremium,
          boostActive,
          row.invoices_limit  ?? 5,
          row.boost_invoices_extra ?? 0,
          row.invoices_used   ?? 0,
        ),
      },
      customers: {
        base:      row.customers_limit ?? 3,
        boost:     boostActive ? (row.boost_customers_extra ?? 0) : 0,
        used:      row.customers_used  ?? 0,
        canCreate: computeCanCreate(
          isPremium,
          boostActive,
          row.customers_limit ?? 3,
          row.boost_customers_extra ?? 0,
          row.customers_used  ?? 0,
        ),
      },
      quotes: {
        base:      row.quotes_limit    ?? 3,
        boost:     boostActive ? (row.boost_quotes_extra ?? 0) : 0,
        used:      row.quotes_used     ?? 0,
        canCreate: computeCanCreate(
          isPremium,
          boostActive,
          row.quotes_limit    ?? 3,
          row.boost_quotes_extra ?? 0,
          row.quotes_used     ?? 0,
        ),
      },
      plan:          row.plan as PlanTier,
      boostActive,
      boostExpiresAt,
      dailyAdsWatched,
      dailyAdsMax:   DAILY_ADS_MAX,
      isLoading:     false,
    };

    // Aggiorna la cache
    await writeCache(orgId, limits);

    return limits;
  } catch (fetchError) {
    // ── Fallback offline ───────────────────────────────────────────────────
    console.warn('[rate-limit-engine] fetchPlanLimits failed, trying cache:', fetchError);

    const cached = await readCache(orgId);

    if (cached) {
      // Cache esiste: usa i dati e mostra toast non bloccante "Dati offline"
      options?.onOfflineToast?.();
      return { ...cached.data, isLoading: false };
    }

    // Nessuna cache: tutti canCreate false + errore bloccante
    options?.onBlockingError?.();
    return buildErrorLimits();
  }
}

// ─── checkLimit ───────────────────────────────────────────────────────────────

/**
 * Funzione pura — nessun side effect, nessuna chiamata asincrona.
 * Controlla se l'utente può creare una risorsa dato lo stato corrente dei limiti.
 *
 * @precondition limits è un PlanLimits valido (non isLoading)
 * @postcondition
 *   - Se isPremium: allowed === true, remaining === Infinity
 *   - Se boostActive e used < base + boost: allowed === true
 *   - Se used >= base + boost AND dailyAdsLeft > 0: allowed === false, reason === 'boost_available'
 *   - Se used >= base + boost AND dailyAdsLeft === 0: allowed === false, reason === 'premium_required'
 *   - remaining è always >= 0 (clamped)
 *
 * Requirements: 1.4, 1.8, 2.11, 2.12, 3.1
 */
export function checkLimit(limits: PlanLimits, resource: ResourceType): CheckLimitResult {
  const isPremium = limits.plan === 'premium';

  if (isPremium) {
    return {
      allowed:   true,
      remaining: Infinity,
    };
  }

  const resourceData = resource === 'invoice'
    ? limits.invoices
    : resource === 'customer'
    ? limits.customers
    : limits.quotes;

  const { base, boost, used } = resourceData;
  const effectiveLimit = limits.boostActive ? base + boost : base;
  const remaining = Math.max(0, effectiveLimit - used);
  const allowed = used < effectiveLimit;

  if (allowed) {
    return {
      allowed:   true,
      remaining,
    };
  }

  // Limite raggiunto — determina il reason
  const dailyAdsLeft = limits.dailyAdsMax - limits.dailyAdsWatched;

  if (dailyAdsLeft > 0) {
    return {
      allowed:   false,
      reason:    'boost_available',
      remaining: 0,
    };
  }

  return {
    allowed:   false,
    reason:    'premium_required',
    remaining: 0,
  };
}

// ─── applyBoost ───────────────────────────────────────────────────────────────

/**
 * Applica il Business Boost (+3 fatture, +1 cliente, +1 preventivo, 24h).
 * Atomico via Supabase RPC. Idempotente per callbackId.
 *
 * @precondition orgId valido, callbackId univoco per questo evento reward
 * @postcondition
 *   - Se successo: user_plan.boost_*_extra aggiornati, boost_expires_at = now + 24h
 *   - Idempotente: stessa callbackId non può applicare boost due volte (UNIQUE constraint)
 *   - daily_ads_watched incrementato di 1 (se non supera 3)
 * @sideEffects Scrive su user_plan via Supabase RPC 'atomic_apply_boost'
 *
 * Requirements: 2.1, 2.2, 2.8, 2.13, 10.2
 */
export async function applyBoost(orgId: string, callbackId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('atomic_apply_boost', {
      p_org_id:      orgId,
      p_callback_id: callbackId,
    });

    if (error) {
      console.error('[rate-limit-engine] applyBoost RPC failed:', error.message);
      return false;
    }

    return data?.success === true || data !== null;
  } catch (err) {
    console.error('[rate-limit-engine] applyBoost exception:', err);
    return false;
  }
}
