/**
 * EngagementContext.tsx — Context React per l'engagement engine V34
 *
 * Espone lo stato di engagement (streak, milestone, contatori) a tutto l'albero
 * dei componenti, evitando prop drilling per useEngagement.
 *
 * @see Requirements 7.1, 7.5, 9.4, 9.5, 9.9, 9.10
 * @see design.md § 9. EngagementEngine, § State Management Approach
 */

import React, {
  createContext,
  useContext,
  useMemo,
} from 'react';
import { useEngagement, type UseEngagementReturn } from '@/hooks/useEngagement';
import type { UserEngagement, MilestoneEvent } from '@/lib/engagement-engine';

// ─── Tipo Pubblico ────────────────────────────────────────────────────────────

export interface EngagementContextValue {
  /** Stato corrente dell'engagement utente (streak, milestone, contatori lifetime) */
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

// ─── Context ──────────────────────────────────────────────────────────────────

const EngagementContext = createContext<EngagementContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * EngagementProvider
 *
 * Wrappa l'albero e:
 * 1. Usa useEngagement internamente per caricare lo stato da Supabase al mount
 * 2. Espone engagement, pendingMilestone, dismissMilestone, recordAction, isLoading
 * 3. Usa useMemo sul context value per evitare re-render inutili
 *
 * Preconditions:
 *   - Deve essere montato dentro AuthProvider (richiede sessione Supabase attiva)
 *   - Deve essere montato dopo PlanProvider nella gerarchia del root layout
 *
 * Requirements: 7.1, 7.5, 9.4, 9.5, 9.9, 9.10
 */
export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const {
    engagement,
    pendingMilestone,
    dismissMilestone,
    recordAction,
    isLoading,
  }: UseEngagementReturn = useEngagement();

  // ─── Context value con useMemo per evitare re-render inutili ────────────
  /**
   * Requirement 9.9/9.10: useMemo garantisce che i subscriber non ricevano un nuovo
   * oggetto di riferimento a meno che engagement, pendingMilestone o le funzioni
   * callback non cambino effettivamente.
   */
  const contextValue = useMemo<EngagementContextValue>(
    () => ({
      engagement,
      pendingMilestone,
      dismissMilestone,
      recordAction,
      isLoading,
    }),
    [engagement, pendingMilestone, dismissMilestone, recordAction, isLoading],
  );

  return (
    <EngagementContext.Provider value={contextValue}>
      {children}
    </EngagementContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useEngagementContext — accede al context dell'engagement engine.
 *
 * @throws Error se usato fuori da EngagementProvider
 *
 * @example
 * const { engagement, recordAction, pendingMilestone } = useEngagementContext();
 * // Dopo creazione fattura:
 * await recordAction('invoice');
 * // Se pendingMilestone !== null → mostrare MilestoneCelebration
 */
export function useEngagementContext(): EngagementContextValue {
  const ctx = useContext(EngagementContext);
  if (!ctx) {
    throw new Error('useEngagementContext must be used inside <EngagementProvider>');
  }
  return ctx;
}
