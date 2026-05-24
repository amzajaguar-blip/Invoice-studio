/**
 * useRewardedInvoice — Hook per la gestione dei Rewarded Ads
 *
 * Flusso:
 * 1. Controlla il conteggio fatture mensili vs limite (5 free + crediti)
 * 2. Se limite raggiunto → mostra modale
 * 3. Utente sceglie "Guarda video" → carica e mostra annuncio AdMob
 * 4. onEarnedReward → chiama Supabase per accreditare +1 credito
 * 5. Ritorna canCreate = true e sblocca la creazione
 *
 * Idempotency: usa admob_callback_id come chiave. La UNIQUE su ad_impressions
 * impedisce doppie attribuzioni anche in race condition.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { supabase } from './supabase';

// ─── Configurazione ID Annunci ────────────────────────────────────────────────
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-4053625490298263/3442892886'; // ← Il tuo ID reale!

const FREE_INVOICES_LIMIT = 5;

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface InvoiceQuota {
  invoicesThisMonth: number;
  creditsAvailable: number;
  limit: number;         // 5 + crediti
  canCreate: boolean;    // true se invoicesThisMonth < limit
  isLoading: boolean;
}

// ─── Hook principale ──────────────────────────────────────────────────────────

export function useRewardedInvoice(): {
  quota: InvoiceQuota;
  adLoaded: boolean;
  adLoading: boolean;
  adError: string | null;
  showAd: () => void;
  refreshQuota: () => Promise<void>;
} {
  const [quota, setQuota] = useState<InvoiceQuota>({
    invoicesThisMonth: 0,
    creditsAvailable: 0,
    limit: FREE_INVOICES_LIMIT,
    canCreate: true,
    isLoading: true,
  });

  const [adLoaded, setAdLoaded] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [rewarded, setRewarded] = useState<RewardedAd | null>(null);

  // Ref per evitare setState su component unmounted
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // ─── Carica quota dal DB ────────────────────────────────────────────────────

  const refreshQuota = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ottieni org_id dell'utente corrente
      const { data: memberData } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!memberData?.org_id) {
        // Utente senza org (first-launch race) — mostra solo limite base
        if (mountedRef.current) {
          setQuota({
            invoicesThisMonth: 0,
            creditsAvailable: 0,
            limit: FREE_INVOICES_LIMIT,
            canCreate: true,
            isLoading: false,
          });
        }
        return;
      }

      const orgId = memberData.org_id;

      // Conta le fatture del mese corrente
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd)
        .is('deleted_at', null);

      // Leggi crediti dal wallet unificato (org_credits)
      const { data: creditsData } = await supabase
        .from('org_credits')
        .select('earned_credits, consumed_credits')
        .eq('org_id', orgId)
        .maybeSingle();

      const earned = creditsData?.earned_credits ?? 0;
      const consumed = creditsData?.consumed_credits ?? 0;
      const available = Math.max(0, earned - consumed);
      const monthlyCount = invoiceCount ?? 0;
      const effectiveLimit = FREE_INVOICES_LIMIT + available;

      if (mountedRef.current) {
        setQuota({
          invoicesThisMonth: monthlyCount,
          creditsAvailable: available,
          limit: effectiveLimit,
          canCreate: monthlyCount < effectiveLimit,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('refreshQuota failed:', err);
      if (mountedRef.current) {
        setQuota((q) => ({ ...q, isLoading: false }));
      }
    }
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // ─── Carica annuncio rewarded ───────────────────────────────────────────────

  const loadAd = useCallback(() => {
    setAdLoading(true);
    setAdError(null);

    const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (mountedRef.current) {
        setAdLoaded(true);
        setAdLoading(false);
        setRewarded(ad);
      }
    });

    const unsubEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward: { type: string; amount: number }) => {
        // L'evento EARNED_REWARD di AdMob non espone il callback_id direttamente.
        // Usiamo l'ad unit ID + timestamp + reward type come chiave composita.
        // In produzione, implementare SSV lato server per ottenere il vero callback_id.
        const callbackId = `admob_${REWARDED_AD_UNIT_ID}_${Date.now()}_${reward.type}_${reward.amount}`;
        claimCredit(callbackId).then(() => refreshQuota());
      }
    );

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error: Error) => {
      if (mountedRef.current) {
        setAdLoading(false);
        setAdLoaded(false);
        setAdError(error.message);
      }
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (mountedRef.current) {
        setAdLoaded(false);
        setRewarded(null);
      }
      // Precarica il prossimo annuncio in background
      setTimeout(() => {
        if (mountedRef.current) loadAd();
      }, 1000);
    });

    ad.load();

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubError();
      unsubClosed();
    };
  }, [claimCredit, refreshQuota]);

  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, [loadAd]);

  // ─── Mostra annuncio ────────────────────────────────────────────────────────

  const showAd = useCallback(() => {
    if (rewarded && adLoaded) {
      rewarded.show();
    }
  }, [rewarded, adLoaded]);

  // ─── Accreditamento credito con idempotency via RPC atomica ───────────────

  const claimCredit = useCallback(async (admobCallbackId: string) => {
    if (!admobCallbackId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgData } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!orgData?.org_id) return;

    // Chiamata RPC atomica: ad_impressions + org_credits + credit_transactions
    // in una singola transazione PostgreSQL. Nessuna race condition.
    const { data: result, error: rpcError } = await supabase.rpc(
      'atomic_earn_credit',
      {
        p_org_id: orgData.org_id,
        p_user_id: user.id,
        p_callback_id: admobCallbackId,
        p_ad_unit_id: REWARDED_AD_UNIT_ID,
        p_reward_type: 'invoice_credit',
        p_reward_amount: 1,
      }
    );

    if (rpcError) {
      console.error('atomic_earn_credit RPC failed:', rpcError);
    }
  }, []);

  return {
    quota,
    adLoaded,
    adLoading,
    adError,
    showAd,
    refreshQuota,
  };
}
