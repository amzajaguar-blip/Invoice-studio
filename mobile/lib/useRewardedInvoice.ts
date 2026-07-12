/**
 * useRewardedInvoice — invoice quota hook.
 *
 * Rewarded ads were removed for Play Store prep, so the rewarded-ad
 * flow (loadAd/showAd) is disabled (no-op). The quota / monthly-limit logic
 * is preserved unchanged.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

const FREE_INVOICES_LIMIT = 5;

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface InvoiceQuota {
  invoicesThisMonth: number;
  creditsAvailable: number;
  limit: number;              // 5 + crediti disponibili
  canCreate: boolean;         // true se invoicesThisMonth < limit
  isLoading: boolean;
  dailyCreditsUsed: number;   // crediti guadagnati oggi
  dailyMax: number;           // massimo giornaliero (10)
  dailyResetIn: string;       // es. "14h 32m" — tempo al reset
  reason?: "daily_limit_reached" | "max_credits_reached" | "no_credits";
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
    dailyCreditsUsed: 0,
    dailyMax: 10,
    dailyResetIn: "",
  });

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
            dailyCreditsUsed: 0,
            dailyMax: 10,
            dailyResetIn: "",
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
        .select('earned_credits, consumed_credits, daily_earned_credits, daily_period_date')
        .eq('org_id', orgId)
        .maybeSingle();

      const earned = creditsData?.earned_credits ?? 0;
      const consumed = creditsData?.consumed_credits ?? 0;
      const available = Math.max(0, earned - consumed);
      const monthlyCount = invoiceCount ?? 0;
      const effectiveLimit = FREE_INVOICES_LIMIT + available;

      // ── Daily limit ──────────────────────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const rawDaily = creditsData?.daily_earned_credits ?? 0;
      const dailyDate = creditsData?.daily_period_date ?? "1970-01-01";
      const dailyCreditsUsed = dailyDate < today ? 0 : rawDaily;
      const DAILY_MAX = 10;

      // Time until midnight (local)
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const msLeft = midnight.getTime() - now.getTime();
      const hLeft = Math.floor(msLeft / 3_600_000);
      const mLeft = Math.floor((msLeft % 3_600_000) / 60_000);
      const dailyResetIn = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;

      const isDailyLimitHit = dailyCreditsUsed >= DAILY_MAX;
      let reason: InvoiceQuota["reason"];
      if (monthlyCount >= effectiveLimit) {
        if (isDailyLimitHit) reason = "daily_limit_reached";
        else if (available >= 300) reason = "max_credits_reached";
        else reason = "no_credits";
      }

      if (mountedRef.current) {
        setQuota({
          invoicesThisMonth: monthlyCount,
          creditsAvailable: available,
          limit: effectiveLimit,
          canCreate: monthlyCount < effectiveLimit,
          isLoading: false,
          dailyCreditsUsed,
          dailyMax: DAILY_MAX,
          dailyResetIn,
          reason,
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

  // ─── Mostra annuncio (rewarded ads disabilitati per Play Store prep) ────────

  const showAd = useCallback(() => {
    // Rewarded ads removed for Play Store prep — no-op.
  }, []);

  return {
    quota,
    adLoaded: false,
    adLoading: false,
    adError: null,
    showAd,
    refreshQuota,
  };
}
