export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { preprocessImage } from "@/lib/ocr-preprocess";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OcrField<T> {
  value: T;
  confidence: number;
}

interface OcrResult {
  supplierName: string | null;
  vatNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  taxableAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string;
  rawText: string;
  confidence: {
    supplierName: number;
    vatNumber: number;
    invoiceNumber: number;
    invoiceDate: number;
    taxableAmount: number;
    vatAmount: number;
    totalAmount: number;
    overall: number;
  };
}

interface OcrError {
  success: false;
  error: string;
  detail?: string;
}

interface OcrSuccess {
  success: true;
  data: OcrResult;
}

type OcrResponse = OcrSuccess | OcrError;

// ─── Regex patterns ──────────────────────────────────────────────────────────

const VENDOR_KEYWORD_RE =
  /\b(S\.R\.L\.|S\.P\.A\.|S\.A\.S\.|S\.N\.C\.|S\.C\.|S\.C\.A\.R\.L\.|S\.C\.R\.L\.|ditta|studio|impresa|società|azienda)\b/i;

const PIVA_RE = /\b(?:IT\s*)?(\d{11})\b/;
const CF_RE = /\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/i;

const INVOICE_NUM_STRONG_RE =
  /\b(?:fattura|fatt\.?)\s*(?:n\.?)?\s*[:#]?\s*(\d{1,6}[-/\d]*)\b/i;
const INVOICE_NUM_WEAK_RE =
  /\b(?:num\.?|numero)\s*(?:n\.?)?\s*[:#]?\s*(\d{1,8})\s*(?:del|di|fattura)?\b/i;

const DATE_RE = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/;

const TOTAL_KW_RE =
  /\b(?:totale|total|importo\s+totale|da\s+pagare|netto\s+a\s+pagare|tot\.?\s+(?:fattura|documento)?)\b/i;

const TAXABLE_STRONG_RE = /\b(?:imponibile|base\s+imponibile|totale\s+imponibile)\b/i;
const TAXABLE_WEAK_RE = /\bimp\.?\s+imponibile\b/i;

const VAT_KW_RE = /\b(?:iva|i\.v\.a\.|imposta)\b/i;

// Match monetary amounts: Italian-style (1.234,56), standard (1234.56), or integer (1220)
// The (?:[.,]\d{2})? makes decimal places optional
const AMOUNT_RE = /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\b/;

// ─── Tesseract worker pool ──────────────────────────────────────────────────

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerReady = false;

async function getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (workerReady && workerInstance) {
    return workerInstance;
  }
  if (!workerInstance) {
    workerInstance = await createWorker(["ita", "eng"]);
    workerReady = true;
  }
  return workerInstance;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse an Italian-formatted number string to a float.
 * "1.234,56" → 1234.56   "1234,56" → 1234.56   "1234.56" → 1234.56
 * "1220" → 1220          "1.220" → 1220         "1,220" → 1220
 */
function parseItalianNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "");
  const commaIdx = cleaned.lastIndexOf(",");
  const dotIdx = cleaned.lastIndexOf(".");

  // No separators at all — simple integer or decimal with dot
  if (commaIdx === -1 && dotIdx === -1) {
    return parseFloat(cleaned) || 0;
  }

  // Italian format: comma is decimal, dots are thousands (e.g., "1.234,56")
  if (commaIdx > dotIdx && cleaned.length - commaIdx - 1 === 2) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }

  // Standard format: dot is decimal, commas are thousands (e.g., "1,234.56")
  if (dotIdx > commaIdx && cleaned.length - dotIdx - 1 === 2) {
    return parseFloat(cleaned.replace(/,/g, ""));
  }

  // Integer with thousands separator only: "1.220" or "1,220" (3 digits after last sep)
  const lastSepIdx = Math.max(commaIdx, dotIdx);
  const afterLastSep = cleaned.length - lastSepIdx - 1;
  if (lastSepIdx !== -1 && afterLastSep === 3) {
    return parseFloat(cleaned.replace(/[.,]/g, ""));
  }

  // Fallback: just strip non-numeric except dot
  return parseFloat(cleaned.replace(/,/g, ".").replace(/[^\d.]/g, ""));
}

/** Find a monetary amount near a keyword within ±2 lines. */
function findAmountNearKeyword(
  lines: string[],
  keywordRe: RegExp
): OcrField<number | null> {
  for (let i = 0; i < lines.length; i++) {
    if (keywordRe.test(lines[i])) {
      // Search current line and up to 2 lines below
      for (let offset = 0; offset <= 2; offset++) {
        const idx = i + offset;
        if (idx >= lines.length) break;
        const match = lines[idx].match(AMOUNT_RE);
        if (match) {
          const raw = match[1];
          const amount = parseItalianNumber(raw);

          // Skip if the match looks like a year (2000-2100) in a non-monetary context
          const digitsOnly = raw.replace(/[.,]/g, "");
          const isYear = /^(20|19)\d{2}$/.test(digitsOnly);
          if (isYear) {
            const hasMonetaryContext =
              /[€$£]|\bEUR\b|\bUSD\b|\bGBP\b/i.test(lines[idx]) ||
              /[€$£]|\bEUR\b|\bUSD\b|\bGBP\b/i.test(lines[i]);
            if (!hasMonetaryContext) continue;
          }

          return { value: amount, confidence: 85 };
        }
      }
    }
  }
  return { value: null, confidence: 0 };
}

/** Check if a date string represents a valid DD/MM/YYYY date. */
function isValidDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  // Simple month-length check
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;
  return true;
}

// ─── P.IVA Checksum Validation ──────────────────────────────────────────────

/**
 * Validate Italian Partita IVA using the Luhn-based checksum algorithm.
 *
 * Digits 1-10 are weighted alternating 1,2,1,2,1,2,1,2,1,2.
 * For products > 9, subtract 9 (digit-sum shortcut).
 * Check digit = (10 - (sum % 10)) % 10, must match 11th digit.
 */
function validateItalianVat(piva: string): boolean {
  if (piva.length !== 11) return false;
  if (!/^\d{11}$/.test(piva)) return false;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(piva[i]!, 10);
    if (i < 10) {
      sum += i % 2 === 0 ? digit : (digit * 2 > 9 ? digit * 2 - 9 : digit * 2);
    }
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(piva[10]!, 10);
}

// ─── Field parsers ───────────────────────────────────────────────────────────

function parseSupplierName(lines: string[]): OcrField<string | null> {
  // Look for company-type keywords
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (line.length > 2 && VENDOR_KEYWORD_RE.test(line)) {
      return { value: line.slice(0, 80), confidence: 80 };
    }
  }

  // Fallback: first non-empty, non-numeric line near the top
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.length > 2 && !/^\d/.test(line) && !/^(pagina|page|data|spett\.)/i.test(line)) {
      return { value: line.slice(0, 80), confidence: 60 };
    }
  }

  return { value: null, confidence: 0 };
}

function parseVatNumber(text: string): OcrField<string | null> {
  // Exact P.IVA (11 digits, optionally prefixed with IT)
  const pivaMatch = text.match(PIVA_RE);
  if (pivaMatch) {
    const isValid = validateItalianVat(pivaMatch[1]);
    return { value: pivaMatch[1], confidence: isValid ? 95 : 25 };
  }

  // Codice Fiscale (16 chars)
  const cfMatch = text.match(CF_RE);
  if (cfMatch) {
    return { value: cfMatch[1], confidence: 70 };
  }

  // Fuzzy: any 11-digit sequence that passes checksum
  const fuzzyMatch = text.match(/\b(\d{11})\b/);
  if (fuzzyMatch) {
    const isValid = validateItalianVat(fuzzyMatch[1]);
    return { value: fuzzyMatch[1], confidence: isValid ? 85 : 25 };
  }

  return { value: null, confidence: 0 };
}

function parseInvoiceNumber(text: string): OcrField<string | null> {
  // Strong: "fattura N. 124" → confidence 95
  const strongMatch = text.match(INVOICE_NUM_STRONG_RE);
  if (strongMatch) {
    return { value: strongMatch[1], confidence: 95 };
  }

  // Weak: "Numero 124 del 15/03" → confidence 70
  const weakMatch = text.match(INVOICE_NUM_WEAK_RE);
  if (weakMatch) {
    return { value: weakMatch[1], confidence: 70 };
  }

  // Fallback: look for a standalone number on a line near "fattura" context
  const fatturaIdx = text.search(/\b(?:fattura|fatt\.?)\b/i);
  if (fatturaIdx !== -1) {
    const nearby = text.slice(fatturaIdx, fatturaIdx + 80);
    const numMatch = nearby.match(/\b(\d{1,8})\b/);
    if (numMatch) {
      return { value: numMatch[1], confidence: 60 };
    }
  }

  return { value: null, confidence: 0 };
}

function parseInvoiceDate(text: string): OcrField<string | null> {
  const match = text.match(DATE_RE);
  if (!match) {
    return { value: null, confidence: 0 };
  }

  const [, d, m, y] = match;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const yearRaw = parseInt(y, 10);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

  if (isValidDate(day, month, year)) {
    return {
      value: `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`,
      confidence: 95,
    };
  }

  // Ambiguous (e.g. US format could be wrong)
  return {
    value: `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`,
    confidence: 60,
  };
}

function parseTotalAmount(text: string): OcrField<number | null> {
  const lines = text.split("\n");
  return findAmountNearKeyword(lines, TOTAL_KW_RE);
}

function parseTaxableAmount(text: string): OcrField<number | null> {
  const lines = text.split("\n");
  // Strong: explicit keyword (imponibile, base imponibile, totale imponibile)
  let result = findAmountNearKeyword(lines, TAXABLE_STRONG_RE);
  if (result.value !== null) {
    result.confidence = 80;
    return result;
  }
  // Weak: "imp. imponibile" — only when "imp." is followed by "imponibile"
  result = findAmountNearKeyword(lines, TAXABLE_WEAK_RE);
  if (result.value !== null) {
    result.confidence = 65;
  }
  return result;
}

function parseVatAmount(text: string): OcrField<number | null> {
  const lines = text.split("\n");
  const result = findAmountNearKeyword(lines, VAT_KW_RE);
  if (result.value !== null) {
    result.confidence = 80;
  }
  return result;
}

function parseTotalFallback(text: string): OcrField<number | null> {
  // Fallback: last monetary-looking number in the document
  const all = [...text.matchAll(AMOUNT_RE)];
  // Filter out matches that look like years (2000-2100)
  const monetary = all.filter((m) => {
    const digitsOnly = m[1].replace(/[.,]/g, "");
    return !/^(20|19)\d{2}$/.test(digitsOnly);
  });
  if (monetary.length > 0) {
    const last = monetary[monetary.length - 1][1];
    return { value: parseItalianNumber(last), confidence: 50 };
  }
  return { value: null, confidence: 0 };
}

function detectCurrency(text: string): string {
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  if (/\$|\bUSD\b/i.test(text)) return "USD";
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  return "EUR";
}

/** Compute overall confidence as the average of all non-zero field scores. */
function computeOverall(confidences: Record<string, number>): number {
  const scores = Object.values(confidences).filter((c) => c > 0);
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

// ─── Base64 decoding ─────────────────────────────────────────────────────────

interface DecodedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Decode a base64 image string (with or without data-URI prefix).
 * Returns the raw buffer and detected mime type.
 */
function decodeBase64(raw: string): DecodedImage | { error: string } {
  if (!raw || typeof raw !== "string") {
    return { error: "Missing or invalid imageBase64" };
  }

  // Check data-URI prefix
  const dataUriMatch = raw.match(
    /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/i
  );

  if (dataUriMatch) {
    const mimeType = dataUriMatch[1];
    const payload = dataUriMatch[2];
    try {
      return { buffer: Buffer.from(payload, "base64"), mimeType };
    } catch {
      return { error: "Failed to decode base64 payload" };
    }
  }

  // Raw base64 — strip any whitespace, detect type from magic bytes later
  try {
    const cleaned = raw.replace(/\s/g, "");
    const buffer = Buffer.from(cleaned, "base64");
    // Detect PDF by magic bytes
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { buffer, mimeType: "application/pdf" };
    }
    return { buffer, mimeType: "image/unknown" };
  } catch {
    return { error: "Failed to decode base64 payload" };
  }
}

function isEmptyBase64(buffer: Buffer): boolean {
  return buffer.length === 0;
}

// ─── POST /api/ocr/receipt ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<OcrResponse>> {
  // ── Authentication ─────────────────────────────────────────────────────

  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── Parse request body ──────────────────────────────────────────────────

  let imageBase64: string;
  try {
    const body = await request.json();
    imageBase64 = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing required field: imageBase64" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // ── Decode base64 ───────────────────────────────────────────────────────

  const decoded = decodeBase64(imageBase64);
  if ("error" in decoded) {
    return NextResponse.json(
      { success: false, error: "Invalid base64 data", detail: decoded.error },
      { status: 400 }
    );
  }

  if (isEmptyBase64(decoded.buffer)) {
    return NextResponse.json(
      { success: false, error: "Empty image data" },
      { status: 400 }
    );
  }

  // ── Warn on PDF ─────────────────────────────────────────────────────────
  // Tesseract.js WASM does not support PDF natively. We still attempt OCR
  // but the result will likely be empty text.

  // ── Preprocess image (skip for PDFs) ────────────────────────────────────

  let imageBuffer = decoded.buffer;

  if (decoded.mimeType.startsWith("image/")) {
    try {
      imageBuffer = await preprocessImage(decoded.buffer);
    } catch (err) {
      console.warn(
        "[ocr] Image preprocessing threw, continuing with original:",
        err instanceof Error ? err.message : err
      );
      imageBuffer = decoded.buffer;
    }
  }

  // ── Run OCR ─────────────────────────────────────────────────────────────

  let rawText: string;

  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    // Worker kept alive for next request — do NOT terminate
    rawText = (text ?? "").trim();
  } catch (err) {
    // Worker might be in bad state — recreate next time
    try { await workerInstance?.terminate(); } catch { /* ignore */ }
    workerInstance = null;
    workerReady = false;
    console.error("OCR processing failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    if (decoded.mimeType === "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "PDF OCR is not directly supported",
          detail:
            "Tesseract.js cannot process PDFs. Convert PDF pages to images (png/jpg) before sending. " +
            `Underlying error: ${message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "OCR processing failed",
        detail: message,
      },
      { status: 500 }
    );
  }

  // ── Handle empty output ─────────────────────────────────────────────────

  if (!rawText || rawText.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No text could be extracted from the image",
        detail:
          decoded.mimeType === "application/pdf"
            ? "PDF files require conversion to image format before OCR."
            : "The image may be blurry, too dark, or contain no readable text.",
      },
      { status: 422 }
    );
  }

  // ── Parse fields ────────────────────────────────────────────────────────

  const lines = rawText.split("\n");
  const trimmedLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);

  const supplierNameField = parseSupplierName(trimmedLines);
  const vatNumberField = parseVatNumber(rawText);
  const invoiceNumberField = parseInvoiceNumber(rawText);
  const invoiceDateField = parseInvoiceDate(rawText);
  const totalAmountField = parseTotalAmount(rawText);
  const taxableAmountField = parseTaxableAmount(rawText);
  const vatAmountField = parseVatAmount(rawText);

  // If no "near keyword" total was found, fall back to last monetary number
  const finalTotal =
    totalAmountField.value !== null
      ? totalAmountField
      : parseTotalFallback(rawText);

  const currency = detectCurrency(rawText);

  const confidence = {
    supplierName: supplierNameField.confidence,
    vatNumber: vatNumberField.confidence,
    invoiceNumber: invoiceNumberField.confidence,
    invoiceDate: invoiceDateField.confidence,
    taxableAmount: taxableAmountField.confidence,
    vatAmount: vatAmountField.confidence,
    totalAmount: finalTotal.confidence,
    overall: 0,
  };
  confidence.overall = computeOverall(confidence);

  // ── Build response ──────────────────────────────────────────────────────

  const data: OcrResult = {
    supplierName: supplierNameField.value,
    vatNumber: vatNumberField.value,
    invoiceNumber: invoiceNumberField.value,
    invoiceDate: invoiceDateField.value,
    taxableAmount: taxableAmountField.value,
    vatAmount: vatAmountField.value,
    totalAmount: finalTotal.value,
    currency,
    rawText,
    confidence,
  };

  return NextResponse.json({ success: true, data });
}
