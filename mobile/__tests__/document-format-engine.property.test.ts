/**
 * Property test P9 — Document_Format_Engine: output DOC non è PDF rinominato
 * Feature: vela-pivot-prodotto, Property 9: DOC/RTF output magic bytes
 * Requirements: 19.4, 19.6
 */
import * as fc from 'fast-check';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy');
jest.mock('expo-sharing');

const mockWriteAs = FileSystem.writeAsStringAsync as jest.Mock;
const mockRead = FileSystem.readAsStringAsync as jest.Mock;

describe('P9: Document_Format_Engine — DOC/RTF non sono PDF rinominati', () => {
  beforeEach(() => {
    mockWriteAs.mockResolvedValue(undefined);
    (FileSystem.documentDirectory as any) = 'file:///tmp/';
  });

  it('DOCX inizia con magic bytes PK ZIP (50 4B 03 04)', async () => {
    // Feature: vela-pivot-prodotto, Property 9: DOCX magic bytes
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 1, maxLength: 100 }),
          amount: fc.float({ min: 1, max: 10000 }),
        }),
        async (data) => {
          const { generateDocumentDOC } = await import('../lib/document-format-engine');

          let capturedBase64 = '';
          mockWriteAs.mockImplementation(async (_path: string, content: string) => {
            capturedBase64 = content;
          });

          await generateDocumentDOC({
            type: 'quote',
            title: data.title,
            lineItems: [{ description: data.description, quantity: 1, rate: data.amount, amount: data.amount }],
            totals: { subtotal: data.amount, grandTotal: data.amount, currency: 'EUR' },
          });

          // DOCX (ZIP) magic bytes: PK\x03\x04 → base64 starts with 'UEsD'
          // oppure il buffer raw inizia con bytes 50 4B 03 04
          expect(capturedBase64.length).toBeGreaterThan(0);
          // base64 di PK\x03\x04 = 'UEsD'
          const startsWithPK = capturedBase64.startsWith('UEsD') || capturedBase64.startsWith('UEs');
          expect(startsWithPK).toBe(true);
        }
      ),
      { numRuns: 10 } // ridotto perché Packer.toArrayBuffer è costoso
    );
  });

  it('RTF inizia con magic bytes {\\rtf', async () => {
    // Feature: vela-pivot-prodotto, Property 9: RTF magic bytes
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 1, maxLength: 100 }),
          amount: fc.float({ min: 1, max: 10000 }),
        }),
        async (data) => {
          const { generateDocumentRTF } = await import('../lib/document-format-engine');

          let capturedContent = '';
          mockWriteAs.mockImplementation(async (_path: string, content: string) => {
            capturedContent = content;
          });

          await generateDocumentRTF({
            type: 'quote',
            title: data.title,
            lineItems: [{ description: data.description, quantity: 1, rate: data.amount, amount: data.amount }],
            totals: { subtotal: data.amount, grandTotal: data.amount, currency: 'EUR' },
          });

          // RTF inizia con {\rtf1
          expect(capturedContent).toMatch(/^\{\\rtf/);
          // Contiene il generator header
          expect(capturedContent).toContain('Milo Office');
        }
      ),
      { numRuns: 100 }
    );
  });
});
