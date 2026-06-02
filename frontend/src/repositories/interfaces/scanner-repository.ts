// ─── Scanner Repository interface ───
// NO API implementation. Mock only.

import type { ScannerExtractedData } from "@/types/states/scanner";

export interface ScannerRepository {
  /** Get the remaining free scans for the current month. */
  getRemainingScans(orgId: string): Promise<number>;

  /** Submit an image for OCR processing. Returns extracted data. */
  processImage(
    orgId: string,
    imageBase64: string,
  ): Promise<ScannerExtractedData>;

  /** Confirm the extracted data and create a draft invoice from it. */
  confirmAndCreateInvoice(
    orgId: string,
    data: ScannerExtractedData,
  ): Promise<{ invoiceId: string }>;
}
