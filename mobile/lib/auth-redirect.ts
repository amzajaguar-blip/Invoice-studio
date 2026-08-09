/**
 * auth-redirect.ts — Schema e URL di redirect per il flusso OAuth / recovery.
 *
 * Perche' questo file esiste
 * ──────────────────────────
 * Gli URL di redirect che l'app manda a Supabase devono comparire nella
 * allowlist di Supabase Auth (Dashboard > Authentication > URL Configuration).
 * Se `redirectTo` non e' in allowlist, Supabase NON restituisce errore: ignora
 * il valore e rimanda al Site URL, cioe' al sito web. Sul telefono l'utente
 * vede il browser tornare alla pagina di login e sembra che il login "non
 * funzioni", senza nessun messaggio d'errore.
 *
 * `Linking.createURL()` costruisce l'URL dal PRIMO schema dichiarato in
 * app.json > expo.scheme. Quando quel campo e' un array, expo-linking prende
 * `manifestSchemes[0]` e ignora gli altri (vedi expo-linking/build/Schemes.js,
 * `const [scheme, ...extraSchemes] = manifestSchemes`). Basta quindi
 * riordinare l'array per cambiare, silenziosamente, l'URL inviato a Supabase e
 * rompere il login.
 *
 * Per questo lo schema qui e' esplicito e non dedotto: finche' la allowlist di
 * Supabase contiene `vela://`, l'app deve mandare `vela://`, indipendentemente
 * da come e' ordinato app.json.
 *
 * Come passare a `milo-office://`
 * ───────────────────────────────
 * 1. Supabase Dashboard > Authentication > URL Configuration > Redirect URLs:
 *    aggiungere `milo-office://auth/callback` e `milo-office://(auth)/reset-password`
 *    LASCIANDO anche quelli `vela://`, cosi le versioni gia' installate
 *    continuano a funzionare.
 * 2. Solo dopo, cambiare AUTH_SCHEME qui sotto in "milo-office".
 * 3. Le due voci `vela://` si possono togliere dalla allowlist quando non ci
 *    sono piu' installazioni delle versioni vecchie.
 */

/**
 * Schema usato per i deep link di autenticazione.
 * DEVE corrispondere a quanto e' in allowlist su Supabase Auth.
 */
export const AUTH_SCHEME = 'vela';

/**
 * URL di callback del login OAuth (Google).
 *
 * Costruito a mano, NON con `Linking.createURL()`.
 *
 * In una build standalone con custom scheme, `getHostUri()` di expo-linking
 * ritorna null, quindi `hostUri` diventa '' e viene passato a
 * `ensureLeadingSlash('', true)` che restituisce '/'. L'URL finale e':
 *
 *   `${scheme}:${''}/${hostUri}${path}`
 *   = 'vela' + ':' + '' + '/' + '/' + '/auth/callback'
 *   = 'vela:///auth/callback'          <-- TRE slash
 *
 * Supabase confronta `redirect_to` con la allowlist carattere per carattere:
 * `vela:///auth/callback` non combacia con `vela://auth/callback`, e quando
 * non combacia GoTrue non da' errore — rimanda al Site URL. Il browser torna
 * alla pagina di login, in silenzio.
 *
 * Due slash e' anche la forma usata da PASSWORD_RESET_URL qui sotto e dal
 * commento in app/_layout.tsx, cioe' quella che ci si aspetta in allowlist.
 */
export function getOAuthCallbackUrl(): string {
  return `${AUTH_SCHEME}://auth/callback`;
}

/** URL di atterraggio del link di reset password inviato via email. */
export const PASSWORD_RESET_URL = `${AUTH_SCHEME}://(auth)/reset-password`;
