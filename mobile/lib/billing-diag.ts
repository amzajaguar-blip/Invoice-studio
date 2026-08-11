/**
 * billing-diag.ts — diagnostica del flusso d'acquisto attivabile in release.
 *
 * Il paywall aveva la diagnostica dietro `__DEV__`, cioe' visibile solo in una
 * build che non puo' comprare niente: Google Play Billing non serve gli APK di
 * debug. Il risultato era che l'unica build in grado di riprodurre il problema
 * era anche l'unica senza strumenti per capirlo.
 *
 * Il flag e' una variabile d'ambiente Expo, letta a build time: una build di
 * store non la definisce e la diagnostica resta invisibile a chi paga.
 */
export const BILLING_DIAG =
  __DEV__ || process.env.EXPO_PUBLIC_BILLING_DIAG === '1';

/**
 * Estrae da un errore RevenueCat tutto cio' che distingue una causa dall'altra.
 *
 * `e.message` da solo non basta: RevenueCat traduce famiglie diverse di
 * fallimento nello stesso testo generico ("There was a problem with the
 * store."). Il codice leggibile e il messaggio dello strato sottostante — che
 * su Android e' letteralmente la stringa di BillingClient, per esempio
 * "BILLING_UNAVAILABLE" oppure "This version of the application is not
 * configured for billing through Google Play" — sono l'unica parte
 * diagnosticabile a distanza.
 */
export function describeBillingError(e: any): string {
  const parts: string[] = [];
  const code = e?.code ?? e?.userInfo?.readableErrorCode;
  if (code !== undefined && code !== null) parts.push(`code=${code}`);
  const readable = e?.readableErrorCode ?? e?.userInfo?.readableErrorCode;
  if (readable && readable !== code) parts.push(`readable=${readable}`);
  const underlying = e?.underlyingErrorMessage ?? e?.userInfo?.NSUnderlyingError;
  if (underlying) parts.push(`underlying=${String(underlying)}`);
  return parts.join(' · ');
}

/**
 * Traduce il fallimento in una diagnosi leggibile quando la causa e' nota.
 *
 * Vale la pena distinguere un solo caso, ma e' il piu' costoso da sbagliare:
 * Google Play risponde BILLING_UNAVAILABLE quando la copia installata non e'
 * quella che distribuisce lui — firma diversa da quella con cui Play firma
 * l'app, oppure package mai pubblicato su nessun canale. Nessuna modifica al
 * codice dell'app puo' aggirarlo: e' un controllo che avviene fuori dal
 * processo. Confondere questo caso con un product ID sbagliato costa un giro
 * di build inutile.
 */
export function billingDiagnosis(e: any): string | null {
  const haystack = [
    e?.code,
    e?.readableErrorCode,
    e?.userInfo?.readableErrorCode,
    e?.message,
    e?.underlyingErrorMessage,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toUpperCase();

  if (
    haystack.includes('BILLING_UNAVAILABLE') ||
    haystack.includes('BILLINGUNAVAILABLE') ||
    haystack.includes('NOT CONFIGURED FOR BILLING') ||
    haystack.includes('STORE_PROBLEM')
  ) {
    return [
      "Google Play rifiuta la fatturazione per questa copia installata",
      "(BILLING_UNAVAILABLE). Non dipende dai product ID ne' dal codice",
      "dell'app: Play confronta la firma dell'APK installato con quella con",
      "cui distribuisce l'app pubblicata. Un APK installato a mano passa il",
      "controllo solo se firmato con quella stessa chiave; altrimenti va",
      "installato da Play (test interno o condivisione interna delle app).",
    ].join(' ');
  }
  return null;
}
