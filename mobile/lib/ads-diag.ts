/**
 * ads-diag.ts — diagnostica degli annunci attivabile in una build di release.
 *
 * Perche' esiste
 * ──────────────
 * Quando un annuncio non si carica, `reward-ad.ts` risolve `false`.
 * Dal punto di vista dell'utente i due casi
 * "AdMob non ha annunci da servire" e "l'ad unit ID e' sbagliato" sono
 * indistinguibili: in entrambi non compare niente. Senza il codice d'errore
 * dell'SDK, dire quale dei due sia e' una congettura — e una congettura
 * sbagliata costa un ciclo di build, o peggio manda a cercare il problema
 * nella dashboard AdMob quando invece e' nel codice.
 *
 * L'SDK il codice ce l'ha e lo passa a `onAdFailedToLoad`. Questo modulo lo
 * rende leggibile e lo mostra a schermo quando la build lo chiede
 * esplicitamente, esattamente come `billing-diag.ts` fa per gli acquisti.
 *
 * Il flag e' una variabile d'ambiente Expo letta a build time: una build
 * destinata agli utenti non la definisce e la diagnostica resta invisibile.
 */

export const ADS_DIAG =
  __DEV__ || process.env.EXPO_PUBLIC_ADS_DIAG === '1';

/**
 * Traduce l'errore di caricamento in una diagnosi che distingue le cause.
 *
 * I codici che contano sono tre, e portano a tre azioni completamente diverse:
 *
 *   no-fill          AdMob ha ricevuto la richiesta e non ha annunci da
 *                    servire. La configurazione e' giusta. Tipico di un
 *                    account ancora in revisione o di un'ad unit appena
 *                    creata. NON si corregge dal codice.
 *
 *   invalid-request  AdMob ha rifiutato la richiesta: ad unit ID inesistente,
 *                    oppure appartenente a un'app diversa da quella dichiarata
 *                    nel manifest. Questo si corregge dal codice, ed e' il caso
 *                    che non va mai confuso col precedente.
 *
 *   app-id-missing   Manca il meta-data APPLICATION_ID nel manifest: l'SDK non
 *                    parte affatto. Errore di configurazione della build.
 */
export function describeAdError(error: unknown): string {
  const e = error as { code?: unknown; message?: string } | null | undefined;
  const rawCode = e?.code;
  const code = rawCode === undefined || rawCode === null ? '' : String(rawCode);
  const message = e?.message ? String(e.message) : '';
  const haystack = `${code} ${message}`.toLowerCase();

  let verdict = '';
  if (haystack.includes('no-fill') || haystack.includes('no fill')) {
    verdict = 'NO_FILL — richiesta accettata, nessun annuncio disponibile. Configurazione corretta, dipende da AdMob.';
  } else if (haystack.includes('invalid-request') || haystack.includes('invalid request')) {
    verdict = 'INVALID_REQUEST — ad unit ID rifiutato da AdMob. Questo e\' un problema di configurazione dell\'app.';
  } else if (haystack.includes('app-id-missing') || haystack.includes('app id')) {
    verdict = 'APP_ID_MISSING — manca APPLICATION_ID nel manifest.';
  } else if (haystack.includes('network')) {
    verdict = 'NETWORK_ERROR — la richiesta non ha raggiunto AdMob.';
  } else if (haystack.includes('internal')) {
    verdict = 'INTERNAL_ERROR — errore interno dell\'SDK.';
  }

  const parts = [code && `code=${code}`, message && `msg=${message}`, verdict]
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nessun dettaglio dall\'SDK';
}
