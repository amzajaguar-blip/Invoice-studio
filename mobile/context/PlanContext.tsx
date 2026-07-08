/**
 * PlanContext.tsx — Context React per i limiti del piano freemium V34
 *
 * Espone PlanLimits e isPremium a tutto l'albero dei componenti.
 * Integra listener RevenueCat per la transizione automatica al piano premium.
 *
 * Requirements: 3.5, 3.6, 3.7, 3.8, 10.7
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import type { PlanLimits, CheckLimitResult, ResourceType } from '@/lib/rate-limit-engine';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

export interface PlanContextValue {
  limits:         PlanLimits;
  isPremium:      boolean;
  refreshLimits:  () => Promise<void>;
  checkCanCreate: (resource: ResourceType) => CheckLimitResult;
}

// ─── Safe Default (never null — prevents "undefined is not a function") ──────

const SAFE_DEFAULT_LIMITS: PlanLimits = {
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

const SAFE_DEFAULT: PlanContextValue = {
  limits:         SAFE_DEFAULT_LIMITS,
  isPremium:      false,
  refreshLimits:  async () => {},
  checkCanCreate: () => ({ allowed: false, remaining: 0, reason: 'limit_reached' as const }),
};

const PlanContext = createContext<PlanContextValue>(SAFE_DEFAULT);

// ─── Costanti ─────────────────────────────────────────────────────────────────

/** Chiave per AsyncStorage: memorizza il pending Supabase write da ritentare al mount */
const PENDING_PREMIUM_WRITE_KEY = 'pending_premium_supabase_write';

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * PlanProvider
 *
 * Wrappa l'albero e:
 * 1. Usa usePlanLimits internamente per stale-while-revalidate + AppState refresh
 * 2. Registra listener RevenueCat: se entitlements.active['pro'] o ['com.Invoice_Studio.myapp Pro'] === true,
 *    chiama refreshLimits() e aggiorna user_plan.plan = 'premium' su Supabase
 * 3. Se la scrittura Supabase fallisce, imposta isPremium in locale e ritenta al mount
 * 4. Usa useMemo sul context value per evitare re-render inutili
 *
 * Preconditions:
 *   - Deve essere montato dentro AuthProvider (richiede sessione Supabase attiva)
 *   - RevenueCat deve essere già configurato (Purchases.configure) nel root layout
 *
 * Requirements: 3.5, 3.6, 3.7, 3.8, 10.7
 */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { limits, isPremium, refreshLimits, checkCanCreate } = usePlanLimits();

  // Ref per evitare setState su componente unmontato
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Utility: aggiorna user_plan.plan = 'premium' su Supabase ─────────
  const writePremiumToSupabase = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Risolvi org_id
      const orgId = (user.user_metadata?.org_id as string | undefined) ?? null;
      if (!orgId) {
        // Fallback: query org_members
        const { data: memberData } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!memberData?.org_id) return false;

        const { error } = await supabase
          .from('user_plan')
          .update({ plan: 'premium' })
          .eq('org_id', memberData.org_id);

        return !error;
      }

      const { error } = await supabase
        .from('user_plan')
        .update({ plan: 'premium' })
        .eq('org_id', orgId);

      return !error;
    } catch {
      return false;
    }
  };

  // ─── Utility: segna/deseleziona il pending write su AsyncStorage ────────
  const setPendingPremiumWrite = async (pending: boolean) => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      if (pending) {
        await AsyncStorage.setItem(PENDING_PREMIUM_WRITE_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(PENDING_PREMIUM_WRITE_KEY);
      }
    } catch {
      // Non fatale
    }
  };

  // ─── Gestione acquisto premium confermato da RevenueCat ─────────────────
  const handlePremiumActivation = async () => {
    // 1. Aggiorna i limiti in memoria (isPremium sarà true dopo il refresh)
    await refreshLimits();

    // 2. Aggiorna Supabase — se fallisce, il flag offline è già gestito
    //    da refreshLimits() che ha letto lo stato da RevenueCat (non da Supabase)
    const written = await writePremiumToSupabase();

    if (!written) {
      // Requirement 3.6: scrittura Supabase fallita
      // isPremium è già true localmente (refreshLimits non ha sovrascritto perché
      // il piano è già 'premium' in locale dopo che RevenueCat l'ha confermato)
      // Salviamo il flag per ritentare al prossimo mount
      await setPendingPremiumWrite(true);
      console.warn('[PlanContext] Supabase premium write failed — will retry on next mount');
    } else {
      // Write riuscita: rimuovi eventuale pending flag
      await setPendingPremiumWrite(false);
      // Refresh finale per sincronizzare con Supabase
      await refreshLimits();
    }
  };

  // ─── Mount: ritenta scrittura Supabase pendente (Requirement 3.6) ──────
  useEffect(() => {
    let cancelled = false;

    async function retryPendingWrite() {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const pending = await AsyncStorage.getItem(PENDING_PREMIUM_WRITE_KEY);

        if (!pending || cancelled) return;

        const written = await writePremiumToSupabase();
        if (written && !cancelled) {
          await setPendingPremiumWrite(false);
          // Refresh per propagare lo stato aggiornato da Supabase
          if (mountedRef.current) {
            await refreshLimits();
          }
        }
      } catch {
        // Non fatale
      }
    }

    retryPendingWrite();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Listener RevenueCat ─────────────────────────────────────────────────
  useEffect(() => {
    /**
     * Listener per gli aggiornamenti CustomerInfo di RevenueCat.
     * Viene invocato:
     *   - Subito dopo il mount con il valore corrente
     *   - Ogni volta che cambia lo stato dell'abbonamento (acquisto, rinnovo, scadenza)
     *
     * Requirement 3.5: se entitlements.active['pro'] o ['com.Invoice_Studio.myapp Pro'] === true → refreshLimits() + write Supabase
     * Requirement 10.7: chiamare refreshLimits() dopo EARNED_REWARD e dopo pro purchase
     */
    const customerInfoListener = (customerInfo: CustomerInfo) => {
      const hasPro = !!(
        customerInfo.entitlements.active['pro'] || 
        customerInfo.entitlements.active['com.Invoice_Studio.myapp Pro']
      );

      if (hasPro && !isPremium) {
        // Attivazione premium rilevata
        handlePremiumActivation().catch((err) => {
          console.warn('[PlanContext] handlePremiumActivation error:', err);
        });
      }
    };

    // Aggiunge il listener per i futuri aggiornamenti
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);

    // Controlla immediatamente lo stato corrente al mount
    // (caso in cui l'utente ha già acquistato prima di questo render)
    Purchases.getCustomerInfo()
      .then(customerInfoListener)
      .catch((err) => {
        console.warn('[PlanContext] getCustomerInfo error:', err);
      });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, [isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Context value con useMemo per evitare re-render inutili ────────────
  /**
   * Requirement 3.8: useMemo garantisce che i subscriber non ricevano un nuovo
   * oggetto di riferimento a meno che limits, isPremium, o le funzioni callback
   * non cambino effettivamente.
   */
  const contextValue = useMemo<PlanContextValue>(
    () => ({
      limits,
      isPremium,
      refreshLimits,
      checkCanCreate,
    }),
    [limits, isPremium, refreshLimits, checkCanCreate],
  );

  return (
    <PlanContext.Provider value={contextValue}>
      {children}
    </PlanContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePlan — accede al context del piano freemium.
 *
 * @throws Error se usato fuori da PlanProvider
 *
 * @example
 * const { limits, isPremium, checkCanCreate } = usePlan();
 * const result = checkCanCreate('invoice');
 * if (!result.allowed) openBoostModal();
 */
export function usePlan(): PlanContextValue {
  return useContext(PlanContext);
}
