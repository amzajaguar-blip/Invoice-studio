/**
 * Valida la Partita IVA italiana.
 *
 * Formato accettato 1: 11 cifre              → "01234567890"
 * Formato accettato 2: prefisso IT + 11 cifre → "IT01234567890"
 *
 * Il campo è opzionale: una stringa vuota o di soli spazi restituisce { valid: true }.
 *
 * Algoritmo checksum Luhn-like:
 * - Posizioni pari   (0, 2, 4, 6, 8): somma diretta della cifra
 * - Posizioni dispari (1, 3, 5, 7, 9): cifra × 2; se risultato > 9 sottrai 9
 * - Cifra di controllo (posizione 10): (10 - (somma % 10)) % 10 deve uguagliare la cifra
 *
 * Requisiti: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function validatePartitaIVA(raw: string): { valid: boolean; error?: string } {
  // Normalizza: trim, uppercase, rimuove prefisso "IT"
  const cleaned = raw.trim().toUpperCase().replace(/^IT/, "");

  // Requisito 2.1 — campo opzionale: stringa vuota o solo spazi è valida
  if (cleaned.length === 0) {
    return { valid: true };
  }

  // Requisito 2.4 — deve essere esattamente 11 cifre
  if (!/^\d{11}$/.test(cleaned)) {
    return { valid: false, error: "P.IVA deve essere 11 cifre (es. 01234567890)" };
  }

  // Requisiti 2.2, 2.3, 2.5 — verifica checksum Luhn-like sulle prime 10 cifre
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (i % 2 === 0) {
      // posizioni pari (0, 2, 4, 6, 8): somma diretta
      sum += digit;
    } else {
      // posizioni dispari (1, 3, 5, 7, 9): doppio, se > 9 sottrai 9
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  const expectedCheck = (10 - (sum % 10)) % 10;
  const actualCheck = parseInt(cleaned[10], 10);

  if (expectedCheck !== actualCheck) {
    return { valid: false, error: "P.IVA non valida (codice di controllo errato)" };
  }

  return { valid: true };
}

export default validatePartitaIVA;
