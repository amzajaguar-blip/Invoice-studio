/**
 * usePlanLimits.ts — Hook per i limiti del piano freemium V34
 *
 * Implementa stale-while-revalidate: carica immediatamente da cache AsyncStorage
 * al mount, poi aggiorna in background via fetchPlanLimits.
 * Aggiunge AppState listener per refresh automatico al ritorno in foreground.
 *
 * Requirements: 1.6, 1.7, 10.5, 10.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchPlanLimits,
  checkLimit,
  type PlanLimits,
  type CheckLimitResult,
  type ResourceType,
} from '@/lib/rate-limit-engine';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

export interface UsePlanLimitsReturn {
  limits:         PlanLimits;
  isPremium:      boolean;
  checkCanCreate: (resource: ResourceType) => CheckLimitResult;
  refreshLimits:  () => Promise<void>;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_KEY_PREFIX = 'plan_limits_';
const CACHE_TIMESTAMP_PREFIX = 'plan_limits_ts_';

// ─── Limiti di default (isLoading) ────────────────────────────────────────────

function buildLoadingLimits(): PlanLimits {
  return {
    invoices:  { base: 5, boost: 0, used: 0, canCreate: false },
    customers: { base: 3, boost: 0, used: 0, canCreate: false },
    quotes:    { base: 3, boost: 0, used: 0, canCreate: false },
    plan:          'free',
    boostActive:   false,
    boostExpiresAt: null,
    dailyAdsWatched: 0,
    dailyAdsMax:   3,
    isLoading:     true,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePlanLimits
 *
 * Preconditions:
 *   - Richiede sessione Supabase attiva (user autenticato)
 *   - Deve essere chiamato all'interno di un provider che ha accesso alla sessione
 *
 * Postconditions:
 *   - limits.isLoading === false entro ~2s dal mount in condizioni normali
 *   - isPremium si aggiorna immediatamente dopo refreshLimits()
 *   - refreshLimits() viene chiamato su ogni transizione AppState 'active'
 *
 * Requirements: 1.6, 1.7, 10.5, 10.6
 */
export function usePlanLimits(): UsePlanLimitsReturn {
  const [limits, setLimits] = useState<PlanLimits>(buildLoadingLimits);
  const [orgId, setOrgId] = useState<string | null>(null);

  const { showToast } = useToast();

  // Ref per evitare setState su componente unmontato
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Risolve org_id dell'utente autenticato ──────────────────────────────
  const resolveOrgId = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Prima prova dai user_metadata (V33 pattern — più veloce)
      const metaOrgId = user.user_metadata?.org_id as string | undefined;
      if (metaOrgId) return metaOrgId;

      // Fallback: query org_members
      const { data } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return data?.org_id ?? null;
    } catch {
      return null;
    }
  }, []);

  // ─── Legge la cache AsyncStorage ────────────────────────────────────────
  const readCachedLimits = useCallback(async (id: string): Promise<{
    limits: PlanLimits;
    cachedAt: number;
  } | null> => {
    try {
      const [raw, tsRaw] = await Promise.all([
        AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${id}`),
        AsyncStorage.getItem(`${CACHE_TIMESTAMP_PREFIX}${id}`),
      ]);

      if (!raw || !tsRaw) return null;

      const parsed: PlanLimits = JSON.parse(raw);
      const cachedAt = parseInt(tsRaw, 10);

      // Ripristina Date da JSON string
      if (parsed.boostExpiresAt) {
        parsed.boostExpiresAt = new Date(parsed.boostExpiresAt);
      }

      return { limits: parsed, cachedAt };
    } catch {
      return null;
    }
  }, []);

  // ─── refreshLimits: aggiorna i limiti da Supabase ───────────────────────
  const refreshLimits = useCallback(async (): Promise<void> => {
    const id = orgId ?? (await resolveOrgId());
    if (!id) return;

    // Aggiorna orgId se non era ancora impostato
    if (!orgId && mountedRef.current) {
      setOrgId(id);
    }

    const fresh = await fetchPlanLimits(id, {
      onOfflineToast: () => {
        showToast({
          message: 'Dati offline — limiti non aggiornati',
          type: 'info',
          duration: 3000,
        });
      },
      onBlockingError: () => {
        // Limiti con tutti canCreate: false sono già restituiti da fetchPlanLimits
        // Il messaggio bloccante è gestito dalla UI che consuma usePlan()
      },
    });

    if (mountedRef.current) {
      setLimits(fresh);

      // Scrivi timestamp separato per controllare la validità cache lato hook
      try {
        await AsyncStorage.setItem(
          `${CACHE_TIMESTAMP_PREFIX}${id}`,
          Date.now().toString(),
        );
      } catch {
        // Non fatale
      }
    }
  }, [orgId, resolveOrgId, showToast]);

  // ─── Mount: stale-while-revalidate ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initLimits() {
      const id = await resolveOrgId();
      if (cancelled || !id) return;

      if (mountedRef.current) {
        setOrgId(id);
      }

      // 1. Carica subito dalla cache (se esiste)
      const cached = await readCachedLimits(id);

      if (cached) {
        const ageMs = Date.now() - cached.cachedAt;
        const isStale = ageMs > CACHE_TTL_MS;

        if (!cancelled && mountedRef.current) {
          // Usa la cache immediatamente — anche se stale, verrà aggiornata sotto
          setLimits({ ...cached.limits, isLoading: !isStale });
        }

        // Se la cache è ancora valida (< 24h), non serve refresh urgente
        if (!isStale) {
          // Aggiorna in background comunque per freschezza
          fetchPlanLimits(id, {
            onOfflineToast: () => {
              if (mountedRef.current) {
                showToast({ message: 'Dati offline', type: 'info', duration: 3000 });
              }
            },
          }).then((fresh) => {
            if (!cancelled && mountedRef.current) {
              setLimits(fresh);
            }
          }).catch(() => {});

          return;
        }

        // Cache scaduta (> 24h): prova a refresh; se fallisce, imposta canCreate: false
        const fresh = await fetchPlanLimits(id, {
          onOfflineToast: () => {
            if (mountedRef.current) {
              showToast({ message: 'Dati offline', type: 'info', duration: 3000 });
            }
          },
          onBlockingError: () => {
            // fetchPlanLimits restituisce già canCreate: false in questo caso
          },
        });

        if (!cancelled && mountedRef.current) {
          setLimits(fresh);
        }
      } else {
        // Nessuna cache: fetch da Supabase
        const fresh = await fetchPlanLimits(id, {
          onOfflineToast: () => {
            if (mountedRef.current) {
              showToast({ message: 'Dati offline', type: 'info', duration: 3000 });
            }
          },
          onBlockingError: () => {},
        });

        if (!cancelled && mountedRef.current) {
          setLimits(fresh);
        }
      }
    }

    initLimits();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── AppState listener: refresh su foreground ───────────────────────────
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshLimits().catch(() => {});
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refreshLimits]);

  // ─── Derivati ────────────────────────────────────────────────────────────
  const isPremium = limits.plan === 'premium';

  const checkCanCreate = useCallback(
    (resource: ResourceType): CheckLimitResult => checkLimit(limits, resource),
    [limits],
  );

  return {
    limits,
    isPremium,
    checkCanCreate,
    refreshLimits,
  };
}
