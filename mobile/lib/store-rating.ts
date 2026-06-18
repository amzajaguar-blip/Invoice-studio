/**
 * StoreRatingStrategy — Richiesta di valutazione store intelligente V34
 *
 * Funzione esportata:
 *  - `maybeRequestReview(orgId, trigger)` — valuta le condizioni di eligibilità
 *    e mostra il prompt nativo solo se tutte le condizioni sono soddisfatte.
 *
 * Contesti VALIDI (possono triggerare la richiesta):
 *  - `'invoice_created'`   — dopo la creazione riuscita di una fattura
 *  - `'pdf_exported'`      — dopo l'export di un PDF
 *  - `'session_5'`         — dopo 5 sessioni app riuscite
 *  - `'milestone_unlocked'`— dopo lo sblocco di un achievement milestone
 *
 * Contesti VIETATI (return false immediatamente, senza valutare cooldown):
 *  - `'after_crash'`           — dopo un crash o errore
 *  - `'after_rewarded_ad'`     — subito dopo un rewarded ad
 *  - `'after_payment_failed'`  — dopo un pagamento fallito
 *  - `'during_critical_flow'`  — durante workflow critici (editor, PDF gen, etc.)
 *
 * Cooldown: 120 giorni per org, persistito in AsyncStorage.
 *
 * @see Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from './analytics-events';

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

/**
 * Contesti VALIDI in cui la richiesta di review può essere triggerata.
 * @see Requirements 19.1
 */
export type ValidReviewTrigger =
  | 'invoice_created'    // dopo la creazione riuscita di una fattura
  | 'pdf_exported'       // dopo l'export di un PDF
  | 'session_5'          // dopo 5 sessioni app riuscite
  | 'milestone_unlocked'; // dopo lo sblocco di un achievement milestone

/**
 * Contesti VIETATI: restituiscono false immediatamente.
 * @see Requirements 19.2
 */
export type ForbiddenReviewTrigger =
  | 'after_crash'           // dopo un crash o errore
  | 'after_rewarded_ad'     // subito dopo un rewarded ad
  | 'after_payment_failed'  // dopo un pagamento fallito
  | 'during_critical_flow'; // durante workflow critici

/**
 * Unione di tutti i trigger possibili (validi + vietati).
 */
export type ReviewTrigger = ValidReviewTrigger | ForbiddenReviewTrigger;

// ─── Costanti ──────────────────────────────────────────────────────────────────

/** Cooldown tra due richieste di review (120 giorni in ms). @see Requirements 19.3 */
const COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

/** Prefisso chiave AsyncStorage — la chiave completa è `${KEY_PREFIX}{orgId}`. @see Requirements 19.6 */
const KEY_PREFIX = 'last_review_request_';

/** Contesti vietati — return false immediato senza valutare altre condizioni. @see Requirements 19.2 */
const FORBIDDEN_TRIGGERS: ReadonlySet<ReviewTrigger> = new Set<ForbiddenReviewTrigger>([
  'after_crash',
  'after_rewarded_ad',
  'after_payment_failed',
  'during_critical_flow',
]);

// ─── Helper interni ────────────────────────────────────────────────────────────

/**
 * Restituisce la chiave AsyncStorage per l'org specificata.
 * @see Requirements 19.6
 */
function storageKey(orgId: string): string {
  return `${KEY_PREFIX}${orgId}`;
}

/**
 * Legge il timestamp dell'ultima richiesta di review per l'org.
 * Restituisce null se non esiste alcun record (primo accesso).
 */
async function getLastReviewTimestamp(orgId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const value = parseInt(raw, 10);
    return isNaN(value) ? null : value;
  } catch (err) {
    console.warn('[store-rating] getLastReviewTimestamp error:', err);
    return null;
  }
}

/**
 * Persiste il timestamp corrente come ultima richiesta di review per l'org.
 * @see Requirements 19.6
 */
async function setLastReviewTimestamp(orgId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(orgId), String(Date.now()));
  } catch (err) {
    console.warn('[store-rating] setLastReviewTimestamp error:', err);
  }
}

// ─── Lazy-import di expo-store-review ────────────────────────────────────────
//
// expo-store-review non è elencato nel package.json, ma fa parte dell'Expo SDK 52
// ed è disponibile sull'app via expo-modules-core. Per garantire che il modulo sia
// caricato in modo sicuro (evitando crash se il bundle non lo include), usiamo un
// import dinamico avvolto in try/catch.
//
// Se il modulo non è disponibile, la funzione restituisce false senza propagare errori.

type StoreReviewModule = {
  requestReview: () => Promise<void>;
  isAvailableAsync: () => Promise<boolean>;
};

async function loadStoreReview(): Promise<StoreReviewModule | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-store-review') as StoreReviewModule;
    return mod;
  } catch {
    return null;
  }
}

// ─── maybeRequestReview ────────────────────────────────────────────────────────

/**
 * Valuta le condizioni di eligibilità e, se soddisfatte, mostra il prompt
 * nativo di review dello store tramite `expo-store-review`.
 *
 * Flusso decisionale (in ordine):
 *  1. Se `trigger` è in `FORBIDDEN_TRIGGERS` → return false immediatamente
 *     (Requirements 19.2)
 *  2. Se il cooldown di 120gg non è scaduto → return false
 *     (Requirements 19.3)
 *  3. Tenta di caricare `expo-store-review`; se non disponibile → return false
 *     (Requirements 19.4 — gestione graceful)
 *  4. Chiama `StoreReview.requestReview()` con try/catch
 *     (Requirements 19.4)
 *  5. Traccia `review_requested` via `trackEvent`
 *     (Requirements 19.5)
 *  6. Persiste il timestamp corrente in AsyncStorage
 *     (Requirements 19.6)
 *  7. Return true — il caller imposta `milestone_review_asked = true`
 *     (Requirements 19.7)
 *
 * @param orgId   - Identificatore dell'organizzazione (usato per il cooldown per-org)
 * @param trigger - Contesto che ha triggerato la richiesta
 * @returns       `true` se la review è stata richiesta, `false` altrimenti
 */
export async function maybeRequestReview(
  orgId: string,
  trigger: ReviewTrigger,
): Promise<boolean> {
  // ── Guard 1: Contesti vietati — return false immediatamente ───────────────
  // @see Requirements 19.2
  if (FORBIDDEN_TRIGGERS.has(trigger)) {
    return false;
  }

  // ── Guard 2: Cooldown 120 giorni ──────────────────────────────────────────
  // @see Requirements 19.3, 19.6
  const lastRequestedAt = await getLastReviewTimestamp(orgId);

  if (lastRequestedAt !== null) {
    const elapsed = Date.now() - lastRequestedAt;
    if (elapsed < COOLDOWN_MS) {
      return false;
    }
  }
  // Se lastRequestedAt === null → prima richiesta, cooldown non applicabile

  // ── Guard 3 + 4: Carica expo-store-review e richiedi review ──────────────
  // @see Requirements 19.4
  const StoreReview = await loadStoreReview();

  if (!StoreReview) {
    // expo-store-review non disponibile nel bundle — fallisci silenziosamente
    console.warn('[store-rating] expo-store-review non disponibile');
    return false;
  }

  try {
    // Controlla disponibilità API nativa (opzionale — non blocca se non supportata)
    const isAvailable =
      typeof StoreReview.isAvailableAsync === 'function'
        ? await StoreReview.isAvailableAsync()
        : true; // assume disponibile se il metodo non esiste

    if (!isAvailable) {
      return false;
    }

    await StoreReview.requestReview();
  } catch (err) {
    // Gestione graceful: un errore nell'API nativa non deve crashare l'app
    console.warn('[store-rating] requestReview error:', err);
    return false;
  }

  // ── Step 5: Traccia l'evento analytics ────────────────────────────────────
  // @see Requirements 19.5, 8.1
  trackEvent({ event: 'review_requested' });

  // ── Step 6: Persisti il timestamp corrente ─────────────────────────────────
  // @see Requirements 19.6
  await setLastReviewTimestamp(orgId);

  // ── Step 7: Return true — il caller imposterà milestone_review_asked = true
  // @see Requirements 19.7
  return true;
}
