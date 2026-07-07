/**
 * useSmartCards.ts — Hook per i contextual cards in-app V34
 *
 * Valuta quale card mostrare per il contesto corrente, controlla i dismissal
 * persistiti in AsyncStorage (24h TTL), e fornisce un metodo per dimettere
 * la card corrente.
 *
 * Flusso:
 *   1. Al mount: `resolveContextualCard` (sincrono) + check AsyncStorage (asincrono)
 *   2. Ad ogni cambio di `limits` o `engagement`: rivaluta la card
 *   3. `dismiss()`: persiste il dismissal e nasconde la card localmente
 *
 * @see Requirements 6.6, 6.8, 6.9
 * @see design.md § 8. InAppMessagingService, § Hooks API useSmartCards
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  resolveContextualCard,
  type CardContext,
  type ContextualCard,
} from '@/lib/in-app-messaging';
import { usePlan } from '@/context/PlanContext';
import { useEngagementContext } from '@/context/EngagementContext';

// ─── Tipi Pubblici ────────────────────────────────────────────────────────────

export interface UseSmartCardsReturn {
  /** La card da mostrare, oppure null se nessuna condizione è soddisfatta o
   *  se la card è stata dismissata nelle ultime 24h */
  card: ContextualCard | null;
  /** Dimette la card corrente persistendo il dismissal in AsyncStorage (24h TTL) */
  dismiss: () => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

/** TTL del dismissal: 24 ore in millisecondi */
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

/** Prefisso chiave AsyncStorage per i dismissal */
const DISMISSED_KEY_PREFIX = 'dismissed_card_';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Restituisce la chiave AsyncStorage per il dismissal di una card.
 * @param cardId - L'id della card (coincide con CardContext)
 */
function dismissalKey(cardId: CardContext): string {
  return `${DISMISSED_KEY_PREFIX}${cardId}`;
}

/**
 * Controlla se la card è ancora sotto TTL di dismissal.
 * Restituisce `true` se la card deve essere soppressa.
 */
async function isDismissed(cardId: CardContext): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(dismissalKey(cardId));
    if (!stored) return false;

    const timestamp = parseInt(stored, 10);
    if (isNaN(timestamp)) return false;

    return Date.now() - timestamp < DISMISS_TTL_MS;
  } catch {
    // In caso di errore AsyncStorage, non sopprimiamo la card
    return false;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSmartCards
 *
 * @param context     - Il CardContext della schermata corrente
 * @param hasDraftQuote - Opzionale: true se esiste almeno un preventivo in bozza
 *
 * @returns `{ card, dismiss }` dove:
 *   - `card` è la ContextualCard da mostrare o null
 *   - `dismiss()` sopprime la card per 24h tramite AsyncStorage
 *
 * Preconditions:
 *   - Deve essere usato dentro PlanProvider e EngagementProvider
 *
 * Postconditions (Requirement 6.6):
 *   - `dismiss()` persiste il timestamp con chiave `dismissed_card_{cardId}`
 *   - La card non viene più restituita per le successive 24h
 *
 * Requirements: 6.6, 6.8, 6.9
 */
export function useSmartCards(
  context: CardContext,
  hasDraftQuote = false,
): UseSmartCardsReturn {
  const { limits } = usePlan();
  const { engagement } = useEngagementContext();

  const [card, setCard] = useState<ContextualCard | null>(null);

  // Ref per evitare setState su componente unmontato
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Rivalutazione della card ─────────────────────────────────────────────
  //
  // 1. Calcolo sincrono via resolveContextualCard (funzione pura)
  // 2. Check asincrono AsyncStorage per verificare il dismissal
  //
  // Dipendenze: limits e engagement — si riesegue ad ogni loro cambio
  useEffect(() => {
    // Guard: skip if limits are still loading or if data is not yet available
    if (!limits || limits.isLoading) return;
    if (!engagement) return;

    // Step 1 — risoluzione sincrona
    let resolved: ContextualCard | null = null;
    try {
      resolved = resolveContextualCard(context, limits, engagement, hasDraftQuote);
    } catch (err) {
      console.warn('[useSmartCards] resolveContextualCard error:', err);
      if (mountedRef.current) setCard(null);
      return;
    }

    if (!resolved) {
      if (mountedRef.current) {
        setCard(null);
      }
      return;
    }

    // Step 2 — check asincrono dismissal
    let cancelled = false;

    isDismissed(resolved.id).then((dismissed) => {
      if (cancelled || !mountedRef.current) return;
      setCard(dismissed ? null : resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [context, limits, engagement, hasDraftQuote]);

  // ─── dismiss() ────────────────────────────────────────────────────────────
  //
  // Persiste il dismissal in AsyncStorage con timestamp corrente.
  // Imposta la card a null immediatamente (ottimistico).
  //
  // Requirement 6.6: chiave `dismissed_card_{cardId}`, TTL 24h
  const dismiss = useCallback(() => {
    if (!card) return;

    const cardId = card.id;

    // Nasconde subito la card nell'UI
    setCard(null);

    // Persiste il dismissal in background (fire-and-forget)
    AsyncStorage.setItem(dismissalKey(cardId), String(Date.now())).catch((err) => {
      console.warn('[useSmartCards] Failed to persist dismissal:', err);
    });
  }, [card]);

  return { card, dismiss };
}
