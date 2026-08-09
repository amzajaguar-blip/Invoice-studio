/**
 * plural.ts — Risoluzione dei marcatori di plurale nelle stringhe tradotte.
 *
 * Perche' esiste
 * ──────────────
 * Le stringhe di conteggio ("{n} document{o|i}") portano il marcatore di
 * plurale dentro il valore tradotto, e ogni lingua usa una convenzione diversa:
 *
 *   it  "{n} document{o|i}"    "{n} bozz{a|e}"      "{n} client{e|i}"
 *   en  "{n} document{s}"      "{n} client{s}"
 *   es  "{n} documento{s}"     "{n} borrador{es}"
 *   de  "{n} Dokument{e}"
 *
 * Prima ogni schermata risolveva il proprio marcatore a mano, con una
 * `.replace("{o|i}", …)` scritta nel componente. Il marcatore era quindi
 * duplicato in due file — la traduzione e il componente — e bastava cambiarne
 * uno per rompere l'altro in silenzio: durante il rebranding le stringhe sono
 * passate da `fattur{a|e}` a `document{o|i}` e da `preventiv{o|i}` a
 * `bozz{a|e}`, ma le `.replace()` sono rimaste quelle vecchie e a schermo
 * comparivano "0 document{o|i}" e "0 bozz{a|e}". In inglese, dove il marcatore
 * e' `{s}`, non ha mai funzionato nessuna delle due.
 *
 * Questo modulo risolve QUALSIASI marcatore senza sapere quale sia, quindi
 * tradurre una stringa non puo' piu' rompere il componente che la mostra.
 *
 * Convenzioni supportate
 * ──────────────────────
 *   {sing|plur}  due alternative: la prima al singolare, la seconda al plurale
 *   {suffisso}   suffisso aggiunto solo al plurale (e rimosso al singolare)
 *
 * Il segnaposto `{n}` viene sostituito con il numero.
 */

/** Marcatore: `{...}` senza spazi interni, per non toccare testo normale. */
const MARKER = /\{([^{}\s]*)\}/g;

/**
 * Risolve `{n}` e i marcatori di plurale di una stringa tradotta.
 *
 * @param template stringa gia' tradotta, es. "{n} document{o|i}"
 * @param count    numero di elementi
 *
 * @example
 * plural("{n} document{o|i}", 0) // "0 documenti"
 * plural("{n} document{o|i}", 1) // "1 documento"
 * plural("{n} document{s}", 1)   // "1 document"
 * plural("{n} document{s}", 3)   // "3 documents"
 */
export function plural(template: string, count: number): string {
  const isSingular = count === 1;

  return String(template ?? '').replace(MARKER, (match, body: string) => {
    if (body === 'n') return String(count);

    if (body.includes('|')) {
      const [singular = '', pluralForm = ''] = body.split('|');
      return isSingular ? singular : pluralForm;
    }

    // Suffisso applicato solo al plurale: "{s}", "{es}", "{e}".
    return isSingular ? '' : body;
  });
}
