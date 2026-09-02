/**
 * Codec base64 auto-contenuto, senza dipendere dai globali `atob`/`btoa`.
 *
 * `atob`/`btoa` sono globali browser/Node, non del motore JS: Hermes (React
 * Native) non li fornisce e questo repo non installa nessun polyfill
 * (`base-64`, `js-base64`, ecc.). Il codice che li chiamava funzionava sotto
 * Jest (Node ha `atob`/`btoa` nativi) ma falliva silenziosamente su
 * dispositivo — causa root del bug "v77 non genera file": vedi
 * mobile/lib/document/validation/index.ts e mobile/lib/file-import.ts.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CHAR_INDEX: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) CHAR_INDEX[CHARS[i]] = i;

/** Equivalente di `btoa`: stringa binaria (un char = un byte 0-255) -> base64. */
export function base64Encode(binary: string): string {
  let out = '';
  let i = 0;
  for (; i + 3 <= binary.length; i += 3) {
    const b0 = binary.charCodeAt(i);
    const b1 = binary.charCodeAt(i + 1);
    const b2 = binary.charCodeAt(i + 2);
    out +=
      CHARS[b0 >> 2] +
      CHARS[((b0 & 3) << 4) | (b1 >> 4)] +
      CHARS[((b1 & 15) << 2) | (b2 >> 6)] +
      CHARS[b2 & 63];
  }
  const remaining = binary.length - i;
  if (remaining === 1) {
    const b0 = binary.charCodeAt(i);
    out += CHARS[b0 >> 2] + CHARS[(b0 & 3) << 4] + '==';
  } else if (remaining === 2) {
    const b0 = binary.charCodeAt(i);
    const b1 = binary.charCodeAt(i + 1);
    out += CHARS[b0 >> 2] + CHARS[((b0 & 3) << 4) | (b1 >> 4)] + CHARS[(b1 & 15) << 2] + '=';
  }
  return out;
}

/**
 * Equivalente di `atob`, ma decodifica direttamente in byte numerici (0-255)
 * invece che in una stringa binaria intermedia.
 *
 * A differenza di un approccio "ignora i caratteri non validi", qui un
 * input malformato lancia — proprio come farebbe `atob` nativo — invece di
 * decodificare silenziosamente un frammento parziale. I chiamanti che
 * vogliono fallire "chiuso" su input corrotto (es. base64ToBytes in
 * document/validation/index.ts) si affidano a questo per restituire byte
 * vuoti invece di byte spazzatura.
 */
export function base64ToBytes(b64: string): number[] {
  const trimmed = b64.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(trimmed)) {
    throw new Error('base64ToBytes: input non è base64 valido');
  }
  const bytes: number[] = [];
  for (let i = 0; i < trimmed.length; i += 4) {
    const e0 = CHAR_INDEX[trimmed[i]];
    const e1 = CHAR_INDEX[trimmed[i + 1]];
    if (e0 === undefined || e1 === undefined) break;
    bytes.push((e0 << 2) | (e1 >> 4));
    const e2 = CHAR_INDEX[trimmed[i + 2]];
    if (e2 === undefined) break;
    bytes.push(((e1 & 15) << 4) | (e2 >> 2));
    const e3 = CHAR_INDEX[trimmed[i + 3]];
    if (e3 === undefined) break;
    bytes.push(((e2 & 3) << 6) | e3);
  }
  return bytes;
}
