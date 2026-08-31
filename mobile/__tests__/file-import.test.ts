/**
 * file-import.test.ts — la soglia PDF deve stare davvero sotto il limite Vercel.
 *
 * Il PDF non si legge sul dispositivo: viaggia in base64 dentro un JSON verso
 * una funzione serverless, il cui body si ferma a 4,5 MB. Una versione
 * precedente aveva fissato la soglia a 4 MB chiamandoli "sicuri", ma 4 MB in
 * base64 diventano 5,33 MB: i file fra 3,38 e 4 MB superavano il controllo e
 * finivano lo stesso nel 413 di piattaforma, cioe' nell'errore generico che il
 * controllo esisteva per evitare.
 *
 * Il test non verifica un numero scelto a mano: verifica la PROPRIETA' — un
 * file grande quanto la soglia deve stare, una volta codificato, entro il
 * limite. Cosi' regge anche il giorno in cui la soglia cambia.
 *
 * Agosto 2026: MAX_IMPORT_BYTES sale da 10 MB a 20 MB. I test esistenti
 * restano validi (la soglia PDF per il body Vercel non e' cambiata); aggiungo
 * un test sul nuovo tetto utente.
 */

import {
  MAX_IMPORT_BYTES,
  MAX_PDF_BYTES_FOR_VERCEL,
  MAX_PDF_MB_FOR_VERCEL,
} from '../lib/file-import';

/** Limite del body di una funzione serverless su Vercel. */
const VERCEL_BODY_LIMIT = Math.floor(4.5 * 1024 * 1024);

/** Lunghezza esatta di una codifica base64: ceil(n/3) gruppi da 4 caratteri. */
const base64Length = (bytes: number) => Math.ceil(bytes / 3) * 4;

describe("soglia PDF per l'estrazione lato server", () => {
  it("un PDF grande quanto la soglia entra nel body ammesso da Vercel", () => {
    expect(base64Length(MAX_PDF_BYTES_FOR_VERCEL)).toBeLessThanOrEqual(VERCEL_BODY_LIMIT);
  });

  it("lascia margine per l'involucro JSON", () => {
    // `{"fileBase64":"…"}` aggiunge una manciata di byte, ma il margine serve
    // soprattutto contro gli arrotondamenti: senza, si sta esattamente sul
    // filo e ogni approssimazione diventa un rifiuto.
    const margine = VERCEL_BODY_LIMIT - base64Length(MAX_PDF_BYTES_FOR_VERCEL);
    expect(margine).toBeGreaterThan(1024);
  });

  it("resta una soglia utile, non un limite simbolico", () => {
    // Se una modifica futura la portasse vicino allo zero il controllo
    // passerebbe comunque, ma l'import dei PDF sarebbe di fatto disattivato.
    expect(MAX_PDF_BYTES_FOR_VERCEL).toBeGreaterThan(2 * 1024 * 1024);
  });

  it("i 4 MB della versione precedente NON sarebbero passati", () => {
    // Il caso concreto da cui nasce questo test.
    expect(base64Length(4 * 1024 * 1024)).toBeGreaterThan(VERCEL_BODY_LIMIT);
  });

  it("la soglia mostrata all'utente non promette piu' di quella applicata", () => {
    // Il messaggio dice "supera {mb} MB": se l'etichetta fosse arrotondata per
    // eccesso, un file accettato a parole verrebbe respinto dal controllo.
    expect(MAX_PDF_MB_FOR_VERCEL * 1024 * 1024).toBeLessThanOrEqual(MAX_PDF_BYTES_FOR_VERCEL);
  });
});

describe("MAX_IMPORT_BYTES (tetto utente, Agosto 2026)", () => {
  it("e' 20 MB esatti — allineato al limite web", () => {
    expect(MAX_IMPORT_BYTES).toBe(20 * 1024 * 1024);
  });

  it("e' maggiore della soglia PDF server-side, cosi' l'utente puo' scegliere un PDF grande quanto il body Vercel ammette", () => {
    // Se questa relazione si rompe, vuol dire che un file ammesso sul lato
    // client viene rifiutato a tradimento dal server.
    expect(MAX_IMPORT_BYTES).toBeGreaterThan(MAX_PDF_BYTES_FOR_VERCEL);
  });
});
