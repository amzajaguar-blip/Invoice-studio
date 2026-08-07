/**
 * quota-engine.ts — Contatore documenti lifetime per piano gratuito
 *
 * Implementa il Quota_Engine per Milo Office.
 * Il contatore è persistito su Supabase (non aggirabile lato client).
 * L'unica fonte di verità per lo stato premium è RevenueCat via iap-engine.ts.
 *
 * VINCOLI CRITICI:
 * - ZERO import da rate-limit-engine.ts o PlanContext.tsx
 * - NON modifica organizations.plan, user_plan.plan
 * - Il contatore vive su Supabase — NON lato client
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const QUOTA_CACHE_KEY = 'milo_quota_cache_v1';
/** TTL cache quota: 5 minuti in ms */
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  total: number;
  limit: number;
  isPremium: boolean;
  networkError?: boolean;
}

interface CachedQuota {
  result: QuotaCheckResult;
  cachedAt: number;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

async function readQuotaCache(orgId: string): Promise<QuotaCheckResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`${QUOTA_CACHE_KEY}_${orgId}`);
    if (!raw) return null;
    const cached: CachedQuota = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > QUOTA_CACHE_TTL_MS) return null;
    return cached.result;
  } catch {
    return null;
  }
}

async function writeQuotaCache(orgId: string, result: QuotaCheckResult): Promise<void> {
  try {
    const cached: CachedQuota = { result, cachedAt: Date.now() };
    await AsyncStorage.setItem(`${QUOTA_CACHE_KEY}_${orgId}`, JSON.stringify(cached));
  } catch {
    // Cache write failure is non-blocking
  }
}

async function invalidateQuotaCache(orgId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${QUOTA_CACHE_KEY}_${orgId}`);
  } catch {
    // Non-blocking
  }
}

// ─── Funzioni pubbliche ────────────────────────────────────────────────────────

/**
 * Verifica se l'utente può generare un documento.
 *
 * Se premium (RevenueCat) → sempre allowed: true.
 * Se free → legge il contatore da Supabase (con cache TTL 5 min).
 * Se errore di rete → usa la cache locale; se assente → allowed: false (pessimistico).
 */
export async function checkQuota(orgId: string): Promise<QuotaCheckResult> {
  // 1. Se abbonato Pro (entitlement 'pro' da RevenueCat), bypass totale del contatore.
  //    Fonte di verità: customerInfo.entitlements.active['pro'] — stessa chiave di
  //    ProUpgrade.tsx:155 e PlanContext.tsx:199. NON usare checkEntitlement() con
  //    product ID one-time (vela.template.premium) come proxy — causa P0 Fase A.
  let premiumActive = false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    premiumActive = !!customerInfo.entitlements.active['pro'];
  } catch {
    // RevenueCat non raggiungibile — pessimistic fallback: non bypass quota.
    // L'utente premium con rete assente vedrà il gate quota, ma non verrà bloccato
    // se ha ancora quota residua. Caso raro; accettabile per MVP.
    premiumActive = false;
  }

  if (premiumActive) {
    return {
      allowed: true,
      remaining: Infinity,
      total: 0,
      limit: Infinity,
      isPremium: true,
    };
  }

  // 2. Leggi dalla cache se disponibile
  const cached = await readQuotaCache(orgId);
  if (cached) return cached;

  // 3. Fetch da Supabase
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('documents_generated_total, quota_limit, documents_reward_credits')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'No data');
    }

    const total = data.documents_generated_total ?? 0;
    const limit = data.quota_limit ?? 5;
    const credits = data.documents_reward_credits ?? 0;
    const effectiveLimit = limit + credits;
    const remaining = Math.max(0, effectiveLimit - total);
    const allowed = total < effectiveLimit;

    const result: QuotaCheckResult = { allowed, remaining, total, limit: effectiveLimit, isPremium: false };
    await writeQuotaCache(orgId, result);
    return result;

  } catch {
    // Errore di rete — fallback pessimistico
    return {
      allowed: false,
      remaining: 0,
      total: 0,
      limit: 5,
      isPremium: false,
      networkError: true,
    };
  }
}

/**
 * Incrementa il contatore quota su Supabase via RPC atomica.
 * Da chiamare DOPO che il documento è stato generato con successo.
 * Invalida la cache locale immediatamente.
 *
 * @throws se la quota è esaurita o se la RPC fallisce
 */
export async function incrementQuota(orgId: string): Promise<void> {
  // Invalida la cache prima della chiamata RPC
  await invalidateQuotaCache(orgId);

  const { data: newTotal, error } = await supabase
    .rpc('increment_document_quota', { org_id: orgId });

  if (error) {
    throw new Error(`Quota increment failed: ${error.message}`);
  }

  if (newTotal === null) {
    // La RPC ritorna NULL quando la quota è esaurita (UPDATE non ha trovato righe)
    throw new Error('Quota exhausted');
  }
}

/**
 * Restituisce il numero di documenti rimanenti nel piano gratuito.
 * Usa la stessa logica di checkQuota (con cache).
 */
export async function getRemainingQuota(orgId: string): Promise<number> {
  const result = await checkQuota(orgId);
  if (result.isPremium) return Infinity;
  return result.remaining;
}
