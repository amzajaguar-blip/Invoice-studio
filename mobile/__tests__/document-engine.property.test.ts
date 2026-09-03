/**
 * Property test — document-engine (nuovo motore document/builders): i 6 formati
 * (pdf, docx, xlsx, rtf, txt, html) producono output valido su input vuoto, ASCII,
 * unicode (emoji/CJK/diacritici) e stringhe al limite di lunghezza.
 *
 * Distinto da document-format-engine.property.test.ts, che testa il motore
 * legacy (`lib/document-format-engine.ts`) — questo file testa i builder del
 * nuovo motore in `lib/document/builders/*`, importati staticamente per lo
 * stesso motivo spiegato nel file legacy: un `import()` dinamico dentro una
 * `fc.asyncProperty` non sopravvive alla trasformazione CommonJS di Jest.
 */
import * as fc from 'fast-check';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { applyTemplate } from '../lib/document/templates';
import { heading, paragraph, text } from '../lib/document/model';
import type { DocumentModel } from '../lib/document/model';
import { buildPdf } from '../lib/document/builders/pdf';
import { buildDocx } from '../lib/document/builders/docx';
import { buildXlsxBase64 } from '../lib/document/builders/xlsx';
import { buildRtfString } from '../lib/document/builders/rtf';
import { buildTxtString } from '../lib/document/builders/txt';
import { buildHtml } from '../lib/document/builders/html';

jest.mock('expo-file-system/legacy');
jest.mock('expo-sharing');
jest.mock('expo-print');

const mockWriteAs = FileSystem.writeAsStringAsync as jest.Mock;
const mockMoveAsync = FileSystem.moveAsync as jest.Mock;
const mockPrintToFile = Print.printToFileAsync as jest.Mock;

/** Le 4 classi di input richieste: vuoto, ASCII, unicode (emoji/CJK/diacritici), lunghezza massima. */
const bodyText = () =>
  fc.oneof(
    fc.constant(''),
    fc.string({ maxLength: 30 }),
    fc.unicodeString({ minLength: 1, maxLength: 30 }),
    fc.string({ minLength: 300, maxLength: 500 })
  );

function buildModel(title: string, body: string): DocumentModel {
  return applyTemplate('simple', {
    metadata: { title: title || 'Documento' },
    blocks: [
      heading(1, [text(title || 'Documento')], { alignment: 'center' }),
      paragraph([text(body)]),
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (FileSystem.documentDirectory as any) = 'file:///tmp/';
  mockWriteAs.mockResolvedValue(undefined);
  mockMoveAsync.mockResolvedValue(undefined);
  mockPrintToFile.mockResolvedValue({ uri: 'file:///tmp/fake-print.pdf' });
});

describe('document-engine builders — matrice formati × classi di input', () => {
  it('PDF: genera sempre {filepath, filename} senza lanciare, per qualunque input', async () => {
    await fc.assert(
      fc.asyncProperty(bodyText(), bodyText(), async (title, body) => {
        const model = buildModel(title, body);
        const result = await buildPdf(model);
        expect(result.filename.endsWith('.pdf')).toBe(true);
        expect(result.filepath.length).toBeGreaterThan(0);
      }),
      { numRuns: 20 }
    );
  });

  it('DOCX inizia con magic bytes PK ZIP (50 4B 03 04)', async () => {
    await fc.assert(
      fc.asyncProperty(bodyText(), bodyText(), async (title, body) => {
        let capturedBase64 = '';
        mockWriteAs.mockImplementation(async (_path: string, content: string) => {
          capturedBase64 = content;
        });
        const model = buildModel(title, body);
        await buildDocx(model);
        expect(capturedBase64.length).toBeGreaterThan(0);
        const startsWithPK = capturedBase64.startsWith('UEsD') || capturedBase64.startsWith('UEs');
        expect(startsWithPK).toBe(true);
      }),
      { numRuns: 10 } // Packer.toBlob e' costoso, come nel test del motore legacy
    );
  });

  it('XLSX (base64 sincrono) inizia con magic bytes PK ZIP', () => {
    fc.assert(
      fc.property(bodyText(), bodyText(), (title, body) => {
        const model = buildModel(title, body);
        const base64 = buildXlsxBase64(model);
        expect(base64.length).toBeGreaterThan(0);
        expect(base64.startsWith('UEsD') || base64.startsWith('UEs')).toBe(true);
      }),
      { numRuns: 30 }
    );
  });

  it('RTF inizia con magic bytes {\\rtf', () => {
    fc.assert(
      fc.property(bodyText(), bodyText(), (title, body) => {
        const model = buildModel(title, body);
        const content = buildRtfString(model);
        expect(content).toMatch(/^\{\\rtf/);
        expect(content).toContain('Milo Office');
      }),
      { numRuns: 50 }
    );
  });

  it('RTF: \\cf punta sempre a un indice numerico valido nella \\colortbl, senza iniettare frammenti hex nel testo', () => {
    fc.assert(
      fc.property(bodyText(), bodyText(), (title, body) => {
        const model = buildModel(title, body);
        const content = buildRtfString(model);

        // Ogni \cf deve essere seguito solo da cifre prima di uno spazio —
        // un colore esadecimale (es. 11181C) lascerebbe una 'C' o 'AF' letterale
        // subito dopo le cifre, che qui verrebbe rifiutato dalla regex.
        const cfMatches = [...content.matchAll(/\\cf(\S*)( |$)/g)];
        for (const [, arg] of cfMatches) {
          expect(arg).toMatch(/^\d+$/);
        }

        // Ogni indice usato deve esistere nella \colortbl generata (numero di
        // entry `;` = numero massimo di indici validi, escluso l'indice 0 auto).
        const colorTableMatch = content.match(/\{\\colortbl;(.*?)\}/);
        expect(colorTableMatch).not.toBeNull();
        const entryCount = (colorTableMatch![1].match(/;/g) ?? []).length;
        for (const [, arg] of cfMatches) {
          const idx = parseInt(arg, 10);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThanOrEqual(entryCount);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('TXT contiene il testo del corpo verbatim (round-trip unicode)', () => {
    fc.assert(
      fc.property(bodyText(), bodyText(), (title, body) => {
        const model = buildModel(title, body);
        const content = buildTxtString(model);
        if (body.trim().length > 0) {
          expect(content).toContain(body);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('HTML: nessun input utente esce senza escaping (< > & non filtrati)', () => {
    fc.assert(
      fc.property(bodyText(), bodyText(), (title, body) => {
        const model = buildModel(title, body);
        const html = buildHtml(model);
        expect(html).toContain('<html');
        // Il corpo puo' contenere < > & non escapati SOLO come parte del markup
        // prodotto dal builder stesso, mai come frammento letterale dell'input utente.
        if (/[<>&]/.test(body) && body.trim().length > 0) {
          expect(html).not.toContain(`>${body}<`);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('HTML: input adversarial tipo <script> viene sempre escapato', () => {
    const adversarial = ['<script>alert(1)</script>', 'a & b < c > d', '"quoted" & \'single\''];
    for (const body of adversarial) {
      const model = buildModel('Titolo', body);
      const html = buildHtml(model);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain(body);
    }
  });
});
