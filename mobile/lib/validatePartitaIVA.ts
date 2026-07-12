import { checkVAT, countries } from 'jsvat';

/**
 * Valida una Partita IVA secondo lo standard EU VAT (VIES).
 * Formato accettato 1: 11 cifre                  → "01234567890" (assunto IT)
 * Formato accettato 2: 2 lettere paese + cifre   → "IT01234578901", "DE123456789", …
 *
 * Il campo è opzionale: una stringa vuota o di soli spazi restituisce { valid: true }.
 *
 * Requisiti: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function validatePartitaIVA(raw: string): { valid: boolean; error?: string } {
  const cleaned = raw.trim().toUpperCase();

  // Requisito 2.1 — campo opzionale: stringa vuota o solo spazi è valida
  if (cleaned.length === 0) {
    return { valid: true };
  }

  const EU_COUNTRY_PREFIXES = ['IT','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];

  let normalized = cleaned;
  const startsWithCountryPrefix = EU_COUNTRY_PREFIXES.some((p) => normalized.startsWith(p));

  if (!startsWithCountryPrefix) {
    // Il DB italiano memorizza 11 cifre senza prefisso: aggiungo "IT" prima di validare
    normalized = 'IT' + normalized;
  }

  const result = checkVAT(normalized, countries);
  if (!result.isValid) {
    return { valid: false, error: 'Partita IVA non valida (formato o codice di controllo errato)' };
  }

  return { valid: true };
}

export default validatePartitaIVA;
