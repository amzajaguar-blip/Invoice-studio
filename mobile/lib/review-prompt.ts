/**
 * ReviewPrompt — conta le sessioni app e chiede la recensione con stelle
 * dopo un po' che l'utente la usa.
 *
 * Riusa il motore già esistente in `store-rating.ts` (cooldown 120gg,
 * tracking analytics, prompt nativo store): qui c'è solo il contatore di
 * sessioni che decide QUANDO chiamarlo con il trigger `'session_5'`, già
 * previsto da quel motore ma mai innescato da nessun punto dell'app.
 *
 * Una "sessione" = un mount di questo hook, cioè un avvio dell'app da parte
 * di un utente autenticato. Non conta le navigazioni interne (il layout che
 * lo monta resta vivo mentre l'utente naviga tra le tab).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { maybeRequestReview } from './store-rating';

const SESSION_COUNT_KEY_PREFIX = 'app_session_count_';

/** Numero di sessioni dopo cui si valuta la richiesta di recensione. */
const SESSIONS_BEFORE_REVIEW_PROMPT = 5;

/**
 * Da chiamare una volta per sessione (un avvio app), quando l'utente è
 * autenticato. Incrementa il contatore persistito e, raggiunta la soglia,
 * delega a `maybeRequestReview` — che applica ancora il cooldown di 120
 * giorni e i trigger vietati, quindi è sicuro chiamarla ad ogni sessione
 * successiva alla quinta: dopo la prima richiesta andata a buon fine resta
 * un no-op silenzioso finché il cooldown non scade.
 */
export async function recordAppSessionAndMaybeAskReview(orgId: string): Promise<void> {
  const key = `${SESSION_COUNT_KEY_PREFIX}${orgId}`;

  try {
    const raw = await AsyncStorage.getItem(key);
    const previousCount = raw ? parseInt(raw, 10) : 0;
    const count = (isNaN(previousCount) ? 0 : previousCount) + 1;
    await AsyncStorage.setItem(key, String(count));

    if (count >= SESSIONS_BEFORE_REVIEW_PROMPT) {
      await maybeRequestReview(orgId, 'session_5');
    }
  } catch (err) {
    console.warn('[review-prompt] recordAppSessionAndMaybeAskReview error:', err);
  }
}
