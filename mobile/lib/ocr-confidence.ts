/**
 * ocr-confidence.ts — OCR Field Confidence Scoring
 * ==================================================
 * Pure functions that compute a per-field confidence score (0.0..1.0) for the
 * data extracted by the receipt/invoice OCR pipeline.
 *
 * ML Kit text recognition does NOT expose per-word confidence natively, so we
 * rely on deterministic heuristics:
 *  - Does the value match the expected format/regex?
 *  - Is it parseable by the relevant typed constructor?
 *
 * Score formula:  confidence = formatScore * presentScore
 *   - formatScore: 1.0 if format_ok, else 0.4
 *   - presentScore: 1.0 if value present, else 0.0
 *
 * Everything in this module is pure (no I/O, no React, no AsyncStorage).
 */

/** Confidence score in the closed interval [0.0, 1.0]. */
export type ConfidenceScore = number;

/** Confidence metadata for a single extracted field. */
export type FieldConfidence = {
  field: string;
  value: string;
  confidence: ConfidenceScore;
  formatOk: boolean;
  present: boolean;
};

// ── Pattern catalogue ───────────────────────────────────────────────────────

/** Strict amount: digits, optional thousands separator, decimal point + 2 digits. */
const RE_AMOUNT = /^\d{1,6}([.,]\d{3})*[.,]\d{2}$/;

/** Italian date: DD/MM/YYYY or DD-MM-YYYY. Year must be 4 digits. */
const RE_DATE = /^(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](\d{4})$/;

/** Italian VAT number: 11 digits, optional "IT" prefix. */
const RE_VAT = /^(IT)?\d{11}$/i;

/** Invoice number: alphanumeric with optional /YYYY suffix and dashes. */
const RE_INVOICE_NUMBER = /^[A-Z0-9][A-Z0-9\-\/]{1,19}(\/\d{2,4})?$/i;

// ── Scoring primitives ─────────────────────────────────────────────────────

function finalScore(formatOk: boolean, present: boolean): ConfidenceScore {
  if (!present) return 0.0;
  return formatOk ? 1.0 : 0.4;
}

function empty(field: string): FieldConfidence {
  return { field, value: "", confidence: 0.0, formatOk: false, present: false };
}

// ── Per-field scorers ──────────────────────────────────────────────────────

/**
 * Amount heuristic:
 *  - present: non-empty trimmed string
 *  - format_ok: matches RE_AMOUNT AND the parsed value is finite
 */
export function scoreAmount(raw: string | null | undefined): FieldConfidence {
  const value = (raw ?? "").trim();
  if (!value) return empty("amount");
  const formatOk = RE_AMOUNT.test(value) && Number.isFinite(parseAmount(value));
  return {
    field: "amount",
    value,
    confidence: finalScore(formatOk, true),
    formatOk,
    present: true,
  };
}

/**
 * Date heuristic:
 *  - present: non-empty trimmed string
 *  - format_ok: matches RE_DATE AND Date can construct it without NaN
 */
export function scoreDate(raw: string | null | undefined): FieldConfidence {
  const value = (raw ?? "").trim();
  if (!value) return empty("date");
  const formatOk = RE_DATE.test(value) && !Number.isNaN(parseDate(value).getTime());
  return {
    field: "date",
    value,
    confidence: finalScore(formatOk, true),
    formatOk,
    present: true,
  };
}

/**
 * Italian VAT heuristic:
 *  - present: non-empty trimmed string
 *  - format_ok: matches RE_VAT (with or without "IT" prefix)
 */
export function scoreVat(raw: string | null | undefined): FieldConfidence {
  const value = (raw ?? "").trim();
  if (!value) return empty("vat_number");
  const digits = value.replace(/^IT/i, "");
  const formatOk = /^\d{11}$/.test(digits);
  return {
    field: "vat_number",
    value,
    confidence: finalScore(formatOk, true),
    formatOk,
    present: true,
  };
}

/**
 * Vendor heuristic:
 *  - present: non-empty trimmed string
 *  - format_ok: at least 2 chars AND at least 2 alpha letters
 *
 * Vendor is always treated as medium confidence (0.5..0.7) — it needs user
 * review even when present and well-formed.
 */
export function scoreVendor(raw: string | null | undefined): FieldConfidence {
  const value = (raw ?? "").trim();
  if (!value) return empty("vendor");
  const alphaCount = (value.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  const formatOk = value.length >= 2 && alphaCount >= 2;
  // Always medium confidence — never high.
  const confidence = formatOk ? 0.7 : 0.4;
  return {
    field: "vendor",
    value,
    confidence,
    formatOk,
    present: true,
  };
}

/**
 * Invoice number heuristic:
 *  - present: non-empty trimmed string
 *  - format_ok: matches RE_INVOICE_NUMBER (alphanumeric + optional /YYYY)
 */
export function scoreInvoiceNumber(raw: string | null | undefined): FieldConfidence {
  const value = (raw ?? "").trim();
  if (!value) return empty("invoice_number");
  const formatOk = RE_INVOICE_NUMBER.test(value);
  return {
    field: "invoice_number",
    value,
    confidence: finalScore(formatOk, true),
    formatOk,
    present: true,
  };
}

// ── Parsers (exported for downstream use) ──────────────────────────────────

/** Parse an amount string in either "1.234,56" (Italian) or "1,234.56" (US) form. */
export function parseAmount(s: string): number {
  // Detect separator: if both . and , present, the LAST one is the decimal sep.
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot === -1 && lastComma === -1) {
    normalized = s;
  } else if (lastDot > lastComma) {
    // dot is decimal — strip commas (thousands)
    normalized = s.replace(/,/g, "");
  } else {
    // comma is decimal — strip dots (thousands)
    normalized = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Parse DD/MM/YYYY or DD-MM-YYYY into a JS Date. NaN-safe. */
export function parseDate(s: string): Date {
  const m = s.match(RE_DATE);
  if (!m) return new Date(NaN);
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1; // JS months are 0-indexed
  const yyyy = parseInt(m[3], 10);
  return new Date(yyyy, mm, dd);
}

// ── Bulk scorer ────────────────────────────────────────────────────────────

/** Threshold below which a field is flagged for manual review. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export type RawExtractedFields = {
  vendor?: string | null;
  date?: string | null;
  amount?: string | null;
  vat_number?: string | null;
  invoice_number?: string | null;
};

/**
 * Score all supported fields at once.
 * Pure function — does not mutate the input.
 */
export function scoreAllFields(
  rawText: string,
  regexExtracted: RawExtractedFields
): Record<string, FieldConfidence> {
  // rawText is intentionally accepted (for future ML features) but currently unused.
  void rawText;
  return {
    vendor: scoreVendor(regexExtracted.vendor),
    date: scoreDate(regexExtracted.date),
    amount: scoreAmount(regexExtracted.amount),
    vat_number: scoreVat(regexExtracted.vat_number),
    invoice_number: scoreInvoiceNumber(regexExtracted.invoice_number),
  };
}

/**
 * Normalize a vendor string for grouping corrections across vendors with
 * minor surface differences (case, trailing spaces, multiple spaces).
 * Returns "" for empty input.
 */
export function normalizeVendorName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
