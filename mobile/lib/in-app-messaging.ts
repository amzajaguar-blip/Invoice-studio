/**
 * InAppMessagingService — Gestione dei contextual cards per schermata
 *
 * Funzione esportata principale:
 *  - `resolveContextualCard(context, limits, engagement)` — funzione pura
 *    che valuta le condizioni e restituisce al massimo una ContextualCard
 *    per il contesto corrente, oppure null.
 *
 * Costanti esportate:
 *  - `CONTEXTUAL_CARDS` — definizioni statiche di tutte le card
 *  - `CARD_ACCENT_COLORS` — colori accent per ogni CardContext
 *
 * @see Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.10
 * @see design.md § 8. InAppMessagingService
 */

import type { PlanLimits } from './rate-limit-engine';
import type { UserEngagement } from './engagement-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Identifica il contesto della schermata corrente.
 * Ogni valore corrisponde a una card specifica.
 *
 * @see Requirement 6.1
 */
export type CardContext =
  | 'dashboard_limit_warning'    // "Sei all'80% del limite fatture"
  | 'invoices_boost_available'   // "Business Boost disponibile"
  | 'customers_upsell'           // "Premium rimuove tutti i limiti clienti"
  | 'quotes_convert_hint'        // "Converti un preventivo in fattura"
  | 'settings_review_ask';       // "Lascia una recensione"

/**
 * Card contestuale mostrata inline in una schermata.
 * Dismissable e con priorità per soppressione/selezione.
 *
 * @see Requirement 6.1, 6.6, 6.8
 */
export interface ContextualCard {
  /** Identificatore univoco — coincide con il CardContext */
  id: CardContext;
  title: string;
  body: string;
  /** Testo del pulsante CTA opzionale */
  cta?: string;
  /** Azione associata al CTA */
  ctaAction?: 'show_boost' | 'show_upgrade' | 'open_review' | 'convert_quote';
  /**
   * Priorità della card: 1 (più urgente) → 5 (meno urgente).
   * Usato dalla UI per decidere quale mostrare se più contesti
   * condividono lo stesso spazio.
   */
  priority: number;
  /** Se true, la card soddisfa le condizioni di visibilità */
  visible: boolean;
}

// ─── Definizioni statiche delle card ─────────────────────────────────────────

/**
 * Mappa di tutte le card disponibili con i loro contenuti statici.
 * Le condizioni di visibilità sono valutate da `resolveContextualCard`.
 *
 * @see Requirements 6.3, 6.4, 6.5, 6.7, 6.10
 */
export const CONTEXTUAL_CARDS: Record<CardContext, Omit<ContextualCard, 'visible'>> = {
  dashboard_limit_warning: {
    id: 'dashboard_limit_warning',
    title: 'Quasi al limite mensile',
    body: "Hai usato l'80% delle tue fatture mensili. Guarda un video per sbloccare 3 in più.",
    cta: 'Business Boost',
    ctaAction: 'show_boost',
    priority: 1,
  },
  invoices_boost_available: {
    id: 'invoices_boost_available',
    title: 'Business Boost disponibile',
    body: 'Guarda un breve video e sblocca subito 3 fatture extra per 24 ore.',
    cta: 'Guarda video',
    ctaAction: 'show_boost',
    priority: 2,
  },
  customers_upsell: {
    id: 'customers_upsell',
    title: 'Stai crescendo!',
    body: 'Hai quasi raggiunto il limite clienti. Passa a Premium per clienti illimitati.',
    cta: 'Upgrade a Premium',
    ctaAction: 'show_upgrade',
    priority: 3,
  },
  quotes_convert_hint: {
    id: 'quotes_convert_hint',
    title: 'Converti in fattura',
    body: 'Hai preventivi in bozza pronti da inviare. Convertili in fattura in un tap.',
    cta: 'Converti ora',
    ctaAction: 'convert_quote',
    priority: 4,
  },
  settings_review_ask: {
    id: 'settings_review_ask',
    title: 'Ti piace InvoiceStudio? ⭐',
    body: 'Lascia una recensione e aiuta altri freelancer a scoprirci!',
    cta: 'Lascia una recensione',
    ctaAction: 'open_review',
    priority: 5,
  },
};

// ─── Colori accent per ogni CardContext ───────────────────────────────────────

/**
 * Colori del bordo accent per ogni CardContext.
 * Se il contesto non ha una entry, il componente deve usare `#888888`.
 *
 * @see Requirements 6.8, 6.9
 */
export const CARD_ACCENT_COLORS: Record<CardContext, string> = {
  dashboard_limit_warning: '#F59E0B',  // Amber — urgenza moderata
  invoices_boost_available: '#3B82F6', // Blue — opportunità boost
  customers_upsell: '#8B5CF6',         // Violet — upsell premium
  quotes_convert_hint: '#10B981',      // Emerald — azione produttiva
  settings_review_ask: '#F97316',      // Orange — engagement
};

/** Colore di fallback se il context non ha un entry in CARD_ACCENT_COLORS */
export const CARD_ACCENT_FALLBACK = '#888888';

// ─── Funzione principale ──────────────────────────────────────────────────────

/**
 * Determina quale card mostrare dato il contesto corrente.
 *
 * Funzione pura: nessun side effect, nessuna chiamata asincrona.
 * La persistenza dei dismissal è responsabilità del chiamante (useSmartCards).
 *
 * @param context      - Il CardContext della schermata corrente
 * @param limits       - I limiti del piano corrente (deve avere isLoading === false)
 * @param limits.isPremium - derivato da limits.plan === 'premium'
 * @param engagement   - Lo stato di engagement dell'utente
 * @param hasDraftQuote - true se esiste almeno un preventivo con status 'draft'
 *
 * @returns La ContextualCard corrispondente se le condizioni sono soddisfatte,
 *          null altrimenti.
 *
 * Postconditions:
 *  - Se isPremium: restituisce sempre null (Requirements 6.2)
 *  - Restituisce al massimo una card per contesto (Requirements 6.1)
 *  - 'dashboard_limit_warning': se invoices_used >= floor(effective_limit * 0.8) (Requirements 6.3)
 *  - 'invoices_boost_available': se dailyAdsLeft > 0 && !boostActive (Requirements 6.4)
 *  - 'customers_upsell': se customers_used >= 2 AND customers base_limit === 3 (Requirements 6.7)
 *  - 'quotes_convert_hint': se hasDraftQuote === true (Requirements 6.10)
 *  - 'settings_review_ask': se totalInvoices >= 3 && !milestone_review_asked (Requirements 6.5)
 *
 * @see Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.10
 */
export function resolveContextualCard(
  context: CardContext,
  limits: PlanLimits,
  engagement: UserEngagement,
  hasDraftQuote = false,
): ContextualCard | null {
  // ── Req 6.2: Premium users never see cards ────────────────────────────────
  if (limits.plan === 'premium') {
    return null;
  }

  const cardDef = CONTEXTUAL_CARDS[context];
  let visible = false;

  switch (context) {
    // ── Req 6.3: dashboard_limit_warning ─────────────────────────────────────
    // Visibile se invoices_used >= floor(effective_invoice_limit * 0.8)
    case 'dashboard_limit_warning': {
      const effectiveLimit = limits.invoices.base + limits.invoices.boost;
      const threshold = Math.floor(effectiveLimit * 0.8);
      visible = limits.invoices.used >= threshold;
      break;
    }

    // ── Req 6.4: invoices_boost_available ────────────────────────────────────
    // Visibile se dailyAdsLeft > 0 AND boost non è già attivo
    case 'invoices_boost_available': {
      const dailyAdsLeft = limits.dailyAdsMax - limits.dailyAdsWatched;
      visible = dailyAdsLeft > 0 && !limits.boostActive;
      break;
    }

    // ── Req 6.7: customers_upsell ────────────────────────────────────────────
    // Visibile se free-plan customer usage >= 2/3 (>= 2 su 3 base)
    case 'customers_upsell': {
      const effectiveCustomerLimit = limits.customers.base + limits.customers.boost;
      const twoThirds = Math.floor(effectiveCustomerLimit * (2 / 3));
      visible = limits.customers.used >= twoThirds && limits.customers.used >= 1;
      break;
    }

    // ── Req 6.10: quotes_convert_hint ────────────────────────────────────────
    // Visibile se esiste almeno un preventivo in status 'draft'
    case 'quotes_convert_hint': {
      visible = hasDraftQuote;
      break;
    }

    // ── Req 6.5: settings_review_ask ─────────────────────────────────────────
    // Visibile se totalInvoices >= 3 AND !milestone_review_asked
    case 'settings_review_ask': {
      visible =
        engagement.totalInvoices >= 3 &&
        !engagement.milestones.review_ask;
      break;
    }

    default: {
      // Contesto non riconosciuto → nessuna card
      visible = false;
    }
  }

  if (!visible) {
    return null;
  }

  // ── Req 6.1: al massimo una card per context ──────────────────────────────
  return {
    ...cardDef,
    visible: true,
  };
}
