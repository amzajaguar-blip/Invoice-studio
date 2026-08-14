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
import type { ResourceType } from '@/lib/rate-limit-engine';
import { useLocale } from "@/components/LocaleProvider";

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

export function useBusinessBoost(): UseBusinessBoostReturn {
  const { t } = useLocale();
  const { limits, refreshLimits } = usePlan();

  // ─── Stato modale ──────────────────────────────────────────────────────
  const [showBoostModal, setShowBoostModal]   = useState(false);
  const [currentResource, setCurrentResource] = useState<ResourceType | null>(null);

  // ─── Stato annuncio ────────────────────────────────────────────────────
  const [adState, setAdState]   = useState<BoostAdState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Riferimento all'oggetto annuncio caricato (per chiamare .show())
  const adRef = useRef<unknown | null>(null);

  // Ref per cleanup del preload (rimuove listener e timeout)
  const cleanupPreloadRef = useRef<(() => void) | null>(null);

  // Contatore di richieste di ricaricamento. Incrementarlo rilancia l'effetto
  // di preload: e' cio' che rende funzionante il bottone "Riprova" dello stato
  // di errore, che prima chiamava showAd() — la quale esce subito se lo stato
  // non e' 'ready', quindi in stato 'error' non poteva mai ricaricare nulla.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Ref per evitare setState su componente unmontato
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Calcolo dailyAdsLeft ─────────────────────────────────────────────
  const dailyAdsLeft = Math.max(0, limits.dailyAdsMax - limits.dailyAdsWatched);

  // ─── Precaricamento annuncio al mount ─────────────────────────────────
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
      onReady: (loadedAd: unknown) => {
        if (mountedRef.current) {
          adRef.current = loadedAd;
          setAdState('ready');
          setErrorMsg(null);
        }
      },
      onError: (msg: string) => {
        if (mountedRef.current) {
          setAdState('error');
          // `msg` e' una chiave i18n (vedi BOOST_UNAVAILABLE_KEY): va tradotta
          // qui, altrimenti finisce a schermo cruda e in inglese.
          setErrorMsg(t(msg));
          adRef.current = null;
        }
      },
      onEarnedReward: (_callbackId: string) => {
        if (mountedRef.current) {
          setAdState('idle');
          adRef.current = null;
        }
      },
      onClosed: () => {
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
  }, [dailyAdsLeft, reloadNonce]);

  // ─── retryAd: riparte dal caricamento dopo un errore ──────────────────
  const retryAd = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  // ─── showAd: mostra l'annuncio già caricato ───────────────────────────
  // NB: qui non si legge piu' `user_metadata.org_id`. La guardia che c'era
  // usciva in silenzio quando quel campo mancava, e il tap sul bottone "Guarda
  // video" non produceva assolutamente nulla — nessun errore, nessun cambio di
  // stato, nessun log visibile all'utente. Il campo non e' garantito: nessuna
  // migrazione o trigger lo scrive, e infatti ogni altro consumatore
  // (PlanContext, usePlanLimits, revenuecat-identity) lo tratta come un
  // tentativo con fallback su `org_members`. Per di piu' `showBoostAd` non ha
  // mai usato quel parametro: la guardia bloccava il bottone per un valore che
  // nessuno leggeva. L'identita' per l'accredito la risolve reward-ad.ts dalla
  // sessione Supabase.
  const showAd = useCallback(() => {
    if (adState !== 'ready' || !adRef.current) return;

    showBoostAd({
      ad: adRef.current,
      onShowing: () => {
        if (mountedRef.current) {
          setAdState('showing');
        }
      },
      onBoostApplied: () => {
        // Il boost e' appena stato scritto sul server: senza questo refresh la
        // UI resta sui limiti vecchi e l'utente non vede cio' che ha ottenuto.
        void refreshLimits();
        if (mountedRef.current) {
          setAdState('idle');
          adRef.current = null;
        }
      },
      onBoostError: () => {
        if (mountedRef.current) {
          setAdState('error');
          // errorMsg e' una CHIAVE i18n, non una frase: BoostCTA la risolve
          // con t(). Prima qui c'era una stringa italiana hardcodata che
          // finiva dentro t() e non corrispondeva ad alcuna chiave.
          setErrorMsg('boost_error_apply');
          adRef.current = null;
        }
      },
    });
  }, [adState, refreshLimits]);

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
    retryAd,
    boostActive:    limits.boostActive,
    boostExpiresIn,
    dailyAdsLeft,
  };

  // ─── openBoostModal ───────────────────────────────────────────────────
  const openBoostModal = useCallback((resource: ResourceType) => {
    setCurrentResource(resource);
    setShowBoostModal(true);
  }, []);

  // ─── closeBoostModal ──────────────────────────────────────────────────
  const closeBoostModal = useCallback(() => {
    setShowBoostModal(false);
    setCurrentResource(null);

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
