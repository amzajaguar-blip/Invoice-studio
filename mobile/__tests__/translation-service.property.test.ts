/**
 * Property tests P11 + P12 — Translation_Service
 * P11: non invia campi non testuali a Gemini
 * P12: fallback graceful su timeout
 * Feature: vela-pivot-prodotto, Properties 11-12
 * Requirements: 21.3, 21.6, 21.10
 */
import * as fc from 'fast-check';

// Mock Gemini API
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// Imposta una chiave API fittizia per i test
process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key-for-unit-tests';

describe('P11: Translation_Service — non invia campi non testuali a Gemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('non invia valori numerici, date ISO, email o P.IVA', async () => {
    // Feature: vela-pivot-prodotto, Property 11: no PII/numeric fields sent
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          numericDesc: fc.float({ min: 0, max: 99999 }).map(String),
          dateDesc: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .map((d) => d.toISOString().slice(0, 10)),
          emailDesc: fc.emailAddress(),
          vatDesc: fc.stringMatching(/^IT\d{11}$/),
          normalDesc: fc.string({ minLength: 2, maxLength: 80 }).filter(
            (s) => !s.match(/^\d+([.,]\d+)?$/) && !s.match(/^\d{4}-\d{2}-\d{2}/) &&
              !s.includes('@') && !s.match(/^IT\d{11}$/i) && s.trim().length > 0
          ),
        }),
        async ({ title, numericDesc, dateDesc, emailDesc, vatDesc, normalDesc }) => {
          let capturedPrompt = '';
          mockGenerateContent.mockImplementation(async (prompt: string) => {
            capturedPrompt = prompt;
            return {
              response: {
                text: () => JSON.stringify({ title, descriptions: [normalDesc] }),
              },
            };
          });

          const { translateDocumentContent } = await import('../lib/translation-service');
          await translateDocumentContent(
            {
              title,
              descriptions: [numericDesc, dateDesc, emailDesc, vatDesc, normalDesc],
              notes: undefined,
            },
            'en'
          );

          // Il prompt non deve contenere valori numerici puri, date ISO, email o P.IVA
          // come campi separati nel payload JSON
          const payloadMatch = capturedPrompt.match(/Input: (.+)$/s);
          if (!payloadMatch) return; // nessuna chiamata API (tutti i campi filtrati)

          const payload = JSON.parse(payloadMatch[1]);
          const allValues = JSON.stringify(payload);

          // Non deve inviare numeri puri
          expect(allValues).not.toContain(`"${numericDesc}"`);
          // Non deve inviare date ISO
          expect(allValues).not.toContain(`"${dateDesc}"`);
          // Non deve inviare email
          expect(allValues).not.toContain(emailDesc);
          // Non deve inviare P.IVA
          expect(allValues).not.toContain(vatDesc);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('P12: Translation_Service — fallback graceful su timeout', () => {
  it('restituisce campi originali con { translated: false, error: "timeout" } senza eccezioni', async () => {
    // Feature: vela-pivot-prodotto, Property 12: timeout fallback
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 2, maxLength: 50 }).filter(
            (s) => s.trim().length > 0 && !s.match(/^\d+([.,]\d+)?([eE][+-]?\d+)?$/) && !s.match(/^\d{4}-\d{2}-\d{2}/)
          ),
          descriptions: fc.array(
            fc.string({ minLength: 2, maxLength: 80 }).filter(
              (s) => s.trim().length > 0 && !s.match(/^\d+([.,]\d+)?([eE][+-]?\d+)?$/) && !s.match(/^\d{4}-\d{2}-\d{2}/)
            ),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ title, descriptions }) => {
          const { translateDocumentContent, TranslationTimeoutError } = await import('../lib/translation-service');

          // Mock Gemini che simula timeout con la classe reale
          mockGenerateContent.mockImplementation(() =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new TranslationTimeoutError()), 1)
            )
          );

          const fields = { title, descriptions };
          const result = await translateDocumentContent(fields, 'en');

          // Deve restituire i campi originali senza eccezione
          expect(result.translated).toBe(false);
          expect(result.error).toBe('timeout');
          // I campi originali devono essere intatti
          expect(result.fields.title).toBe(title);
          expect(result.fields.descriptions).toEqual(descriptions);
        }
      ),
      { numRuns: 100 }
    );
  });
});
