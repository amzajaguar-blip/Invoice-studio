// ─── Scanner UiState ───

import type { UiState } from "./base";

export type ScannerStep = "capture" | "processing" | "review" | "confirming";

export interface ScannerData {
  step: ScannerStep;
  /** Remaining free scans this month. */
  remainingScans: number;
  /** OCR-processed data awaiting review. */
  extractedData: ScannerExtractedData | null;
  /** Whether the captured image is valid. */
  imageValid: boolean;
  /** Error from OCR processing. */
  processingError: string | null;
}

export interface ScannerExtractedData {
  clientName: string | null;
  clientEmail: string | null;
  clientVatNumber: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  total: number | null;
  currency: string | null;
  items: ScannerLineItem[];
  rawText: string;
}

export interface ScannerLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type ScannerUiState = UiState<ScannerData>;
