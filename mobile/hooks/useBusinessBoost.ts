/**
 * useBusinessBoost.ts — Hook per il Business Boost V34
 *
 * Gestisce lo stato del rewarded ad e del modal BusinessBoostModal.
 * Precarica l'annuncio al mount e rispetta il daily cap.
 * Avvia il 6h suggestion cooldown alla chiusura del modal senza reward.
 *
 * Requirements: 2.5, 2.6, 12.3, 12.6
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  preloadBoostAd,
  showBoostAd,
  writeSuggestionCooldown,
  formatTimeRemaining,
  type BoostSession,
  type BoostAdState,
} from '@/lib/business-boost';
import { usePlan } from '@/context/PlanContext';
import { useAuth } from '@/hooks/useAuth';
import type { ResourceType } from '@/lib/rate-limit-engine';
import { type RewardedAd } from 'react-native-google-mobile-ads';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

export interface UseBusinessBoostReturn {
  /** Sessione annuncio rewarded — stato, showAd, boostActive, etc. */
  boostSession:    BoostSession;
  /** True quando il BusinessBoostModal deve essere visibile */
  showBoostModal:  boolean;
  /** Apre il modal e imposta la risorsa corrente */
  openBoostModal:  (resource: ResourceType) => void;
  /**
   * Chiude il modal senza reward:
   * avvia il 6h suggestion cooldown (Req 12.3, 12.6)
   */
  closeBoostModal: () => void;
  /** Risorsa per cui il modal è stato aperto; null se chiuso */
  currentResource: ResourceType | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBusinessBoost
 *
 * Preconditions:
 *   - Deve essere usato dentro PlanProvider e AuthProvider
 *
 * Postconditions:
 *   - Al mount: precarica l'annuncio se dailyAdsLeft > 0 (Req 2.5, 2.6)
 *   - openBoostModal(resource): imposta showBoostModal = true + currentResource
 *   - closeBoostModal(): avvia il 6h cooldown (Req 12.3, 12.6)
 *
 * Requirements: 2.5, 2.6, 12.3, 12.6
 */
export function useBusinessBoost(): UseBusinessBoostReturn {
  const { limits } = usePlan();
  const { user } = useAuth();

  // ─── Stato modale ──────────────────────────────────────────────────────
  const [showBoostModal, setShowBoostModal]   = useState(false);
  const [currentResource, setCurrentResource] = useState<ResourceType | null>(null);

  // ─── Stato annuncio ────────────────────────────────────────────────────
  const [adState, setAdState]   = useState<BoostAdState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Riferimento all'oggetto RewardedAd caricato (per chiamare .show())
  const adRef = useRef<RewardedAd | null>(null);

  // Ref per cleanup del preload (rimuove listener e timeout)
  const cleanupPreloadRef = useRef<(() => void) | null>(null);

  // Ref per evitare setState su componente unmontato
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Calcolo dailyAdsLeft ─────────────────────────────────────────────
  const dailyAdsLeft = Math.max(0, limits.dailyAdsMax - limits.dailyAdsWatched);

  // ─── Precaricamento annuncio al mount ─────────────────────────────────
  /**
   * Algoritmo di precaricamento (da design.md):
   *  1. Se dailyAdsLeft <= 0 → stato = 'unavailable', RETURN
   *  2. stato = 'loading'
   *  3. preloadBoostAd con callbacks onReady/onError/onEarnedReward
   *  4. Timeout 5s gestito internamente da preloadBoostAd
   *
   * Requirements: 2.5, 2.6
   */
  useEffect(() => {
    // Non precaricare se il limite giornaliero è raggiunto (Req 2.5, 2.6)
    if (dailyAdsLeft <= 0) {
      if (mountedRef.current) {
        setAdState('unavailable');
        setErrorMsg('Hai raggiunto il limite giornaliero di 3 video.');
      }
      return;
    }

    // Pulisci eventuale preload precedente
    if (cleanupPreloadRef.current) {
      cleanupPreloadRef.current();
      cleanupPreloadRef.current = null;
    }

    if (mountedRef.current) {
      setAdState('loading');
      setErrorMsg(null);
    }

    const cleanup = preloadBoostAd({
      onReady: (loadedAd: RewardedAd) => {
        if (mountedRef.current) {
          adRef.current = loadedAd;
          setAdState('ready');
          setErrorMsg(null);
        }
      },
      onError: (msg: string) => {
        if (mountedRef.current) {
          setAdState('error');
          setErrorMsg(msg);
          adRef.current = null;
        }
      },
      onEarnedReward: (_callbackId: string) => {
        // Il reward viene gestito da showBoostAd (business-boost.ts).
        // Qui aggiorniamo lo stato dopo la riproduzione.
        if (mountedRef.current) {
          setAdState('idle');
          adRef.current = null;
        }
      },
      onClosed: () => {
        // L'annuncio è stato chiuso (con o senza reward).
        // Ripristiniamo lo stato per permettere un eventuale reload.
        if (mountedRef.current) {
          setAdState('idle');
          adRef.current = null;
        }
      },
    });

    cleanupPreloadRef.current = cleanup;

    return () => {
      if (cleanupPreloadRef.current) {
        cleanupPreloadRef.current();
        cleanupPreloadRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAdsLeft]);

  // ─── showAd: mostra l'annuncio già caricato ───────────────────────────
  /**
   * Funzione di callback da passare a BoostSession.
   * Precondition: adState === 'ready' && adRef.current !== null
   */
  const showAd = useCallback(() => {
    if (adState !== 'ready' || !adRef.current) return;

    const orgId = (user?.user_metadata?.org_id as string | undefined) ?? null;
    if (!orgId) {
      console.warn('[useBusinessBoost] showAd chiamato senza orgId disponibile');
      return;
    }

    showBoostAd({
      ad: adRef.current,
      orgId,
      onShowing: () => {
        if (mountedRef.current) {
          setAdState('showing');
        }
      },
      onBoostApplied: () => {
        if (mountedRef.current) {
          setAdState('idle');
          adRef.current = null;
        }
      },
      onBoostError: () => {
        if (mountedRef.current) {
          setAdState('error');
          setErrorMsg('Errore applicazione boost. Riprova.');
          adRef.current = null;
        }
      },
    });
  }, [adState, user]);

  // ─── Calcolo boostExpiresIn ───────────────────────────────────────────
  const boostExpiresIn: string | null =
    limits.boostActive && limits.boostExpiresAt
      ? formatTimeRemaining(new Date(), limits.boostExpiresAt)
      : null;

  // ─── BoostSession ─────────────────────────────────────────────────────
  const boostSession: BoostSession = {
    state:          adState,
    errorMsg,
    showAd,
    boostActive:    limits.boostActive,
    boostExpiresIn,
    dailyAdsLeft,
  };

  // ─── openBoostModal ───────────────────────────────────────────────────
  /**
   * Imposta showBoostModal = true e currentResource.
   * Requirement: 4.2 (task) — openBoostModal(resource) imposta showBoostModal = true e currentResource
   */
  const openBoostModal = useCallback((resource: ResourceType) => {
    setCurrentResource(resource);
    setShowBoostModal(true);
  }, []);

  // ─── closeBoostModal ──────────────────────────────────────────────────
  /**
   * Chiude il modal e avvia il 6h suggestion cooldown (Req 12.3, 12.6).
   * Il cooldown viene scritto in AsyncStorage tramite writeSuggestionCooldown
   * dalla business-boost.ts.
   */
  const closeBoostModal = useCallback(() => {
    setShowBoostModal(false);
    setCurrentResource(null);

    // Avvia il 6h suggestion cooldown (Req 12.3, 12.6)
    writeSuggestionCooldown(Date.now()).catch((err) => {
      console.warn('[useBusinessBoost] Failed to write suggestion cooldown:', err);
    });
  }, []);

  return {
    boostSession,
    showBoostModal,
    openBoostModal,
    closeBoostModal,
    currentResource,
  };
}
