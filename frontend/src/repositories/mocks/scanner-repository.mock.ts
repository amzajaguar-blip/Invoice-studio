// ─── Scanner Repository — Mock implementation ───

import type { ScannerRepository } from "@/repositories/interfaces/scanner-repository";
import type { ScannerExtractedData } from "@/types/states/scanner";

export function createScannerRepositoryMock(): ScannerRepository {
  return {
    async getRemainingScans(_orgId: string): Promise<number> {
      await new Promise((r) => setTimeout(r, 100));
      return 3;
    },

    async processImage(
      _orgId: string,
      _imageBase64: string,
    ): Promise<ScannerExtractedData> {
      // Simulate OCR delay (1–2.5s)
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1300));

      return {
        clientName: "Studio Legale Rossi",
        clientEmail: "amministrazione@studiolegalerossi.it",
        clientVatNumber: "IT12345678901",
        invoiceNumber: null,
        issueDate: new Date().toISOString().split("T")[0] ?? "2026-06-02",
        dueDate: "2026-07-02",
        total: 1500,
        currency: "EUR",
        items: [
          { description: "Consulenza GDPR", quantity: 1, unitPrice: 1500 },
        ],
        rawText: "Studio Legale Rossi\nConsulenza GDPR — Giugno 2026\nTotale: €1.500,00",
      };
    },

    async confirmAndCreateInvoice(
      _orgId: string,
      _data: ScannerExtractedData,
    ): Promise<{ invoiceId: string }> {
      await new Promise((r) => setTimeout(r, 500));
      return { invoiceId: `inv-scan-${Date.now()}` };
    },
  };
}
