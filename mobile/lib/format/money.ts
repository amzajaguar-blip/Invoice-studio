/**
 * money.ts — Formattazione condivisa da tutti i renderer di documento.
 *
 * Regola d'oro: gli importi viaggiano come `number` fino al layer di
 * rendering, e la formattazione avviene solo qui. Nessun renderer costruisce
 * stringhe di valuta per conto proprio, altrimenti PDF e Word finiscono per
 * mostrare separatori diversi dallo stesso documento.
 *
 * Il renderer XLSX e' l'eccezione voluta: NON usa queste funzioni. In un foglio
 * di calcolo l'importo deve restare un numero, altrimenti l'utente non puo'
 * sommarlo; la valuta la applica il formato cella (`numFmt`).
 */

/** Locale di default: la v1 dei template e' in italiano. */
export const DEFAULT_LOCALE = 'it-IT';

/** Importo con simbolo di valuta, sempre a due decimali. */
export function money(
  value: number,
  currency: string = 'EUR',
  locale: string = DEFAULT_LOCALE
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Valuta non riconosciuta da Intl: si degrada senza rompere l'export.
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Quantita': due decimali, separatore di migliaia locale, nessuna valuta. */
export function qty(value: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Formato numerico Excel per una valuta, da usare come `z` sulle celle. */
export function excelCurrencyFormat(currency: string = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  return `#,##0.00 "${symbol}"`;
}

/** Formato numerico Excel per le quantita'. */
export const EXCEL_QTY_FORMAT = '#,##0.00';
