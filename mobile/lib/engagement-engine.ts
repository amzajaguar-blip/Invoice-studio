/**
 * EngagementEngine — Gestione milestone, streak e trigger celebrazioni
 *
 * Funzioni esportate:
 *  - `computeStreak`    — funzione pura, calcola lo streak aggiornato
 *  - `recordActivity`   — aggiorna streak, milestone, engagement in Supabase;
 *                         ritorna i MilestoneEvent appena raggiunti
 *
 * @see Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.12, 7.14
 * @see design.md § 9. EngagementEngine
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MilestoneState {
  first_invoice:  boolean;
  invoices_10:    boolean;
  invoices_25:    boolean;
  invoices_50:    boolean;
  invoices_100:   boolean;
  invoices_500:   boolean;
  invoices_1000:  boolean;
  clients_100:    boolean;
  review_ask:     boolean;
}

export interface UserEngagement {
  totalInvoices:  number;
  totalCustomers: number;
  totalQuotes:    number;
  currentStreak:  number;
  longestStreak:  number;
  lastActiveDate: string | null;   // ISO date "YYYY-MM-DD" or null
  milestones:     MilestoneState;
  isPremium:      boolean;
}

export type MilestoneType =
  | 'first_invoice'   // 🎉
  | 'invoices_10'     // 🏆
  | 'invoices_25'     // 🏆
  | 'invoices_50'     // 🚀
  | 'invoices_100'    // 💎
  | 'invoices_500'    // 🌟
  | 'invoices_1000'   // 🏆
  | 'clients_100'     // 💼
  | 'review_ask';     // ⭐

export interface MilestoneEvent {
  type:  MilestoneType;
  emoji: string;
  title: string;
  body:  string;
}

// ─── Milestone copy ──────────────────────────────────────────────────────────

const MILESTONE_COPY: Record<MilestoneType, Omit<MilestoneEvent, 'type'>> = {
  first_invoice: {
    emoji: '🎉',
    title: 'Prima fattura creata!',
    body:  'Hai fatto il primo passo. Il tuo business è ufficialmente partito!',
  },
  invoices_10: {
    emoji: '🏆',
    title: '10 fatture create!',
    body:  'Stai costruendo una solida base clienti. Continua così!',
  },
  invoices_25: {
    emoji: '🏆',
    title: '25 fatture create!',
    body:  'Un traguardo importante. Stai crescendo!',
  },
  invoices_50: {
    emoji: '🚀',
    title: '50 fatture create!',
    body:  'Sei un professionista in piena attività. Impressionante!',
  },
  invoices_100: {
    emoji: '💎',
    title: '100 fatture create!',
    body:  'Un professionista affermato. Straordinario!',
  },
  invoices_500: {
    emoji: '🌟',
    title: '500 fatture create!',
    body:  'Sei una leggenda del freelancing. Incredibile!',
  },
  invoices_1000: {
    emoji: '🏆',
    title: '1000 fatture create!',
    body:  'Un risultato epico. Complimenti!',
  },
  clients_100: {
    emoji: '💼',
    title: '100 clienti aggiunti!',
    body:  'Un network straordinario. Il tuo business sta crescendo forte!',
  },
  review_ask: {
    emoji: '⭐',
    title: 'Ti piace VELA?',
    body:  'Lascia una recensione e aiuta altri freelancer a scoprirci!',
  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" string in local timezone */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns yesterday's date as "YYYY-MM-DD" string in local timezone */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Public: computeStreak ────────────────────────────────────────────────────

/**
 * Funzione pura. Calcola lo streak aggiornato.
 *
 * @precondition lastActiveDate è ISO date string "YYYY-MM-DD" oppure null
 * @postcondition
 *   - Se lastActiveDate === oggi  → ritorna currentStreak (nessuna modifica)
 *   - Se lastActiveDate === ieri  → ritorna currentStreak + 1
 *   - In tutti gli altri casi (< ieri, null, futuro) → ritorna 1
 *
 * @see Requirements 7.1, 7.2, 7.3, 7.14
 */
export function computeStreak(
  lastActiveDate: string | null,
  currentStreak: number,
): number {
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (lastActiveDate === today) return currentStreak;
  if (lastActiveDate === yesterday) return currentStreak + 1;
  return 1;
}

// ─── Public: recordActivity ───────────────────────────────────────────────────

/**
 * Chiamato dopo ogni creazione di fattura/cliente/preventivo.
 * Aggiorna streak, milestone, engagement in Supabase (fire-and-forget).
 * Ritorna eventuali MilestoneEvent appena raggiunti (da celebrare nell'UI).
 *
 * @see Requirements 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.12
 */
export async function recordActivity(
  orgId: string,
  activityType: 'invoice' | 'customer' | 'quote',
  currentEngagement: UserEngagement,
): Promise<MilestoneEvent[]> {
  // ── 1. Compute updated counters ──────────────────────────────────────────
  const newInvoices  = currentEngagement.totalInvoices  + (activityType === 'invoice'  ? 1 : 0);
  const newCustomers = currentEngagement.totalCustomers + (activityType === 'customer' ? 1 : 0);
  const newQuotes    = currentEngagement.totalQuotes    + (activityType === 'quote'    ? 1 : 0);

  // ── 2. Compute streak ────────────────────────────────────────────────────
  const newStreak = computeStreak(
    currentEngagement.lastActiveDate,
    currentEngagement.currentStreak,
  );
  const newLongest = Math.max(currentEngagement.longestStreak, newStreak);
  const today = todayStr();

  // ── 3. Evaluate milestones ───────────────────────────────────────────────
  const milestones = currentEngagement.milestones;
  const newMilestones: Partial<MilestoneState> = {};
  const events: MilestoneEvent[] = [];

  function maybeUnlock(
    flag: keyof MilestoneState,
    type: MilestoneType,
    condition: boolean,
  ) {
    if (!milestones[flag] && condition) {
      newMilestones[flag] = true;
      events.push({ type, ...MILESTONE_COPY[type] });
    }
  }

  // Invoice milestones (Requirements 7.5, 7.6, 7.7, 13.1)
  maybeUnlock('first_invoice',  'first_invoice',  newInvoices >= 1);
  maybeUnlock('invoices_10',    'invoices_10',    newInvoices >= 10);
  maybeUnlock('invoices_25',    'invoices_25',    newInvoices >= 25);
  maybeUnlock('invoices_50',    'invoices_50',    newInvoices >= 50);
  maybeUnlock('invoices_100',   'invoices_100',   newInvoices >= 100);
  maybeUnlock('invoices_500',   'invoices_500',   newInvoices >= 500);
  maybeUnlock('invoices_1000',  'invoices_1000',  newInvoices >= 1000);

  // Clients milestone (Requirements 7.8)
  maybeUnlock('clients_100', 'clients_100', newCustomers >= 100);

  // Review ask — after 3+ invoices, only once (Requirements 13.8)
  maybeUnlock('review_ask', 'review_ask', newInvoices >= 3);

  // ── 4. Persist to Supabase (fire-and-forget) ─────────────────────────────
  const updatedMilestones: Partial<MilestoneState> = { ...milestones, ...newMilestones };

  void (async () => {
    try {
      const updatePayload: Record<string, unknown> = {
        total_invoices:  newInvoices,
        total_customers: newCustomers,
        total_quotes:    newQuotes,
        current_streak:  newStreak,
        longest_streak:  newLongest,
        last_active_date: today,
        updated_at:      new Date().toISOString(),
      };

      // Only include milestone fields that changed
      for (const [flag, val] of Object.entries(newMilestones)) {
        if (val) updatePayload[flag] = true;
      }

      const { error } = await supabase
        .from('user_engagement')
        .update(updatePayload)
        .eq('org_id', orgId);

      if (error) {
        console.warn('[engagement-engine] Failed to persist activity:', error.message);
      }
    } catch (err) {
      console.warn('[engagement-engine] Unexpected error persisting activity:', err);
    }
  })();

  // Return the new milestones so the caller can display celebrations
  void updatedMilestones; // suppress unused variable warning
  return events;
}
