/**
 * useEngagement — Hook per il sistema di engagement, streak e milestone
 *
 * Espone:
 *  - `engagement`        — stato corrente dell'engagement utente
 *  - `pendingMilestone`  — milestone appena raggiunta (null se nessuna)
 *  - `dismissMilestone`  — azzera pendingMilestone
 *  - `recordAction`      — registra un'azione (invoice/customer/quote),
 *                          aggiorna engagement e imposta pendingMilestone se necessario
 *
 * Al mount: carica UserEngagement da Supabase (tabella `user_engagement`).
 * Usa useAuth per ottenere orgId (user.id come owner dell'org).
 *
 * @see Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.12, 9.4, 9.5
 * @see design.md § useEngagement
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  recordActivity,
  type UserEngagement,
  type MilestoneEvent,
} from '@/lib/engagement-engine';

// ─── Default empty engagement ─────────────────────────────────────────────────

const DEFAULT_ENGAGEMENT: UserEngagement = {
  totalInvoices:  0,
  totalCustomers: 0,
  totalQuotes:    0,
  currentStreak:  0,
  longestStreak:  0,
  lastActiveDate: null,
  milestones: {
    first_invoice:  false,
    invoices_10:    false,
    invoices_25:    false,
    invoices_50:    false,
    invoices_100:   false,
    invoices_500:   false,
    invoices_1000:  false,
    clients_100:    false,
    review_ask:     false,
  },
  isPremium: false,
};

// ─── Row → domain mapper ──────────────────────────────────────────────────────

/**
 * Maps a raw Supabase `user_engagement` row to the `UserEngagement` domain type.
 * All fields default gracefully so a partial/missing row never throws.
 */
function rowToEngagement(row: Record<string, unknown>): UserEngagement {
  return {
    totalInvoices:  (row.total_invoices  as number)  ?? 0,
    totalCustomers: (row.total_customers as number)  ?? 0,
    totalQuotes:    (row.total_quotes    as number)  ?? 0,
    currentStreak:  (row.current_streak  as number)  ?? 0,
    longestStreak:  (row.longest_streak  as number)  ?? 0,
    lastActiveDate: (row.last_active_date as string | null) ?? null,
    milestones: {
      first_invoice:  (row.milestone_first_invoice  as boolean) ?? false,
      invoices_10:    (row.milestone_10_invoices     as boolean) ?? false,
      invoices_25:    (row.milestone_25_invoices     as boolean) ?? false,
      invoices_50:    (row.milestone_50_invoices     as boolean) ?? false,
      invoices_100:   (row.milestone_100_invoices    as boolean) ?? false,
      invoices_500:   (row.milestone_500_invoices    as boolean) ?? false,
      invoices_1000:  (row.milestone_1000_invoices   as boolean) ?? false,
      clients_100:    (row.milestone_100_clients     as boolean) ?? false,
      review_ask:     (row.milestone_review_asked    as boolean) ?? false,
    },
    isPremium: (row.is_premium as boolean) ?? false,
  };
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseEngagementReturn {
  /** Stato corrente dell'engagement utente */
  engagement:       UserEngagement;
  /** Milestone appena raggiunta — null se nessuna in attesa di celebrazione */
  pendingMilestone: MilestoneEvent | null;
  /** Azzera pendingMilestone (chiamare dopo aver mostrato MilestoneCelebration) */
  dismissMilestone: () => void;
  /**
   * Registra un'azione (invoice / customer / quote).
   * Aggiorna l'engagement locale e imposta pendingMilestone se viene
   * raggiunta una nuova milestone.
   */
  recordAction: (type: 'invoice' | 'customer' | 'quote') => Promise<void>;
  /** True mentre il caricamento iniziale da Supabase è in corso */
  isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEngagement(): UseEngagementReturn {
  const { user } = useAuth();
  // orgId follows the V33/V34 convention: owner's auth.uid() === org_id
  const orgId = user?.id ?? null;

  const [engagement, setEngagement]           = useState<UserEngagement>(DEFAULT_ENGAGEMENT);
  const [pendingMilestone, setPendingMilestone] = useState<MilestoneEvent | null>(null);
  const [isLoading, setIsLoading]             = useState(true);

  // ── Load engagement from Supabase on mount ─────────────────────────────
  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('user_engagement')
          .select('*')
          .eq('org_id', orgId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn('[useEngagement] Failed to load user_engagement:', error.message);
          setIsLoading(false);
          return;
        }

        if (data) {
          setEngagement(rowToEngagement(data as Record<string, unknown>));
        }
        // If no row exists yet, keep DEFAULT_ENGAGEMENT — the first recordAction
        // will upsert the row via engagement-engine.ts
      } catch (err) {
        if (!cancelled) {
          console.warn('[useEngagement] Unexpected error loading engagement:', err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // ── recordAction ────────────────────────────────────────────────────────
  const recordAction = useCallback(
    async (type: 'invoice' | 'customer' | 'quote'): Promise<void> => {
      if (!orgId) return;

      try {
        const newEvents = await recordActivity(orgId, type, engagement);

        // Update local engagement state optimistically
        setEngagement((prev) => {
          const updated = { ...prev };
          if (type === 'invoice')  updated.totalInvoices  = prev.totalInvoices  + 1;
          if (type === 'customer') updated.totalCustomers = prev.totalCustomers + 1;
          if (type === 'quote')    updated.totalQuotes    = prev.totalQuotes    + 1;

          // Apply any newly unlocked milestone flags
          if (newEvents.length > 0) {
            updated.milestones = { ...prev.milestones };
            for (const evt of newEvents) {
              if (evt.type === 'first_invoice')  updated.milestones.first_invoice  = true;
              if (evt.type === 'invoices_10')    updated.milestones.invoices_10    = true;
              if (evt.type === 'invoices_25')    updated.milestones.invoices_25    = true;
              if (evt.type === 'invoices_50')    updated.milestones.invoices_50    = true;
              if (evt.type === 'invoices_100')   updated.milestones.invoices_100   = true;
              if (evt.type === 'invoices_500')   updated.milestones.invoices_500   = true;
              if (evt.type === 'invoices_1000')  updated.milestones.invoices_1000  = true;
              if (evt.type === 'clients_100')    updated.milestones.clients_100    = true;
              if (evt.type === 'review_ask')     updated.milestones.review_ask     = true;
            }
          }

          return updated;
        });

        // Set the first pending milestone (if any)
        if (newEvents.length > 0) {
          setPendingMilestone(newEvents[0]);
        }
      } catch (err) {
        console.warn('[useEngagement] recordAction error:', err);
      }
    },
    [orgId, engagement],
  );

  // ── dismissMilestone ────────────────────────────────────────────────────
  const dismissMilestone = useCallback(() => {
    setPendingMilestone(null);
  }, []);

  return {
    engagement,
    pendingMilestone,
    dismissMilestone,
    recordAction,
    isLoading,
  };
}
