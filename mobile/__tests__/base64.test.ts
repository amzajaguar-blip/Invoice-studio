/**
 * base64.test.ts — round-trip del codec self-contained.
 *
 * mobile/lib/base64.ts esiste perche' `atob`/`btoa` non sono globali garantiti
 * su Hermes (causa root del bug "v77 non genera file": vedi
 * mobile/lib/document/validation/index.ts). Node ha `atob`/`btoa` nativi,
 * quindi questo test non puo' verificare quel bug — verifica solo che il
 * codec sostitutivo sia corretto byte per byte, incluso il padding.
 */

import { base64Encode, base64ToBytes } from '../lib/base64';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

describe('base64Encode / base64ToBytes', () => {
  test('round-trip su stringhe di lunghezza 0, 1, 2, 3 byte (copre tutti i casi di padding)', () => {
    for (let len = 0; len <= 12; len++) {
      const bytes = Array.from({ length: len }, (_, i) => (i * 37 + 5) % 256);
      const encoded = base64Encode(bytesToBinaryString(bytes));
      expect(base64ToBytes(encoded)).toEqual(bytes);
    }
  });

  test('produce lo stesso output di btoa/atob nativi (Node) per un buffer binario reale', () => {
    const bytes = Array.from({ length: 300 }, (_, i) => (i * 97) % 256);
    const binary = bytesToBinaryString(bytes);
    expect(base64Encode(binary)).toBe(Buffer.from(binary, 'binary').toString('base64'));
    const nativeB64 = Buffer.from(binary, 'binary').toString('base64');
    expect(base64ToBytes(nativeB64)).toEqual(bytes);
  });

  test('decodifica correttamente i magic bytes PDF (%PDF)', () => {
    const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
    const encoded = base64Encode(bytesToBinaryString(pdfHeader));
    expect(base64ToBytes(encoded).slice(0, 4)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
