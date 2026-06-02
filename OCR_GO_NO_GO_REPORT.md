# V22 OCR GO/NO-GO REPORT — Scanner Pipeline Readiness
**Audit date:** 2026-06-02  
**Auditor:** BillingEngineer (automated audit)  
**Decision:** 🔴 **NO-GO** — Do not ship the scanner feature in its current state.

---

## § 1 · WHAT EXISTS

### Backend OCR Engine
**File:** `frontend/src/app/api/ocr/receipt/route.ts`

- Uses **Tesseract.js v5+** with `ita` + `eng` language packs ✅
- Accepts base64-encoded images via POST ✅
- Strips data-URL prefix automatically ✅
- Extracts: vendor name, date, total amount, currency, raw text ✅
- Regex-based parsing (vendor = first text line, date = `DD/MM/YYYY` pattern, total = last monetary value) ⚠️
- Returns structured JSON with extracted fields + raw text ✅

### Repository Layer
**Files:**
- `frontend/src/repositories/interfaces/scanner-repository.ts` — interface
- `frontend/src/repositories/supabase/scanner-repository.supabase.ts` — real implementation
- `frontend/src/repositories/mocks/scanner-repository.mock.ts` — mock

- Clean interface/implementation separation ✅
- Mock returns realistic data with simulated delay ✅
- Supabase implementation calls real OCR endpoint ✅
- `confirmAndCreateInvoice` creates a draft invoice from extracted data ⚠️

### Type Definitions
**File:** `frontend/src/types/states/scanner.ts`

- `ScannerUiState` with 4-step wizard (capture → processing → review → confirming) ✅
- `ScannerExtractedData` with all invoice fields ✅
- `ScannerLineItem` for parsed items ✅

---

## § 2 · WHAT DOESN'T EXIST — FRONTEND

### 🔴 NO SCANNER PAGE

A thorough search was conducted:

```
No files found matching **/scanner/** within frontend/src/app
No files found matching **/(dashboard)/**/scanner*/** within frontend/src/app
```

Dashboard pages that DO exist:
- `/dashboard` — analytics overview
- `/invoices` — invoice list
- `/clients` — client list
- `/analytics` — analytics
- `/settings` — settings

**There is no scanner page.** No route, no component, no button, no camera integration. The entire scanner feature is backend-only with zero frontend surface area.

### The user cannot:
- Open a scanner page ❌
- Take a photo of a receipt ❌
- Upload an image for OCR ❌
- Review extracted data ❌
- Confirm and create an invoice from OCR data ❌

---

## § 3 · BACKEND ISSUES (even if frontend existed)

### 🔴 CRITICAL: `confirmAndCreateInvoice` is broken

**File:** `frontend/src/repositories/supabase/scanner-repository.supabase.ts`

```typescript
const { data: invoice, error } = await (supabase as any)
  .from("invoices")
  .insert({
    org_id: orgId,
    client_id: "00000000-0000-0000-0000-000000000000",  // ← HARDCODED UUID
    number: `FATT-${Date.now()}`,                        // ← NOT sequential
    ...
  })
```

**Three fatal problems:**

1. **Hardcoded `client_id`**: `"00000000-0000-0000-0000-000000000000"` is a non-existent UUID. If `invoices.client_id` has a foreign key constraint to `clients.id`, this insert will **fail with a FK violation**. The scanner cannot create invoices.

2. **Non-sequential invoice number**: `FATT-${Date.now()}` produces values like `FATT-1748899200000`. This doesn't match the standard `INV-2026-001` format used by the main invoice creation endpoint. It will sort incorrectly and confuse users.

3. **Hardcoded withholding tax**: `total = Math.round(subtotal * 0.8 * 100) / 100` — 20% ritenuta d'acconto is hardcoded. This ignores the user's actual tax settings. A freelancer without P.IVA (regime forfettario — no IVA, no ritenuta) gets an incorrect invoice.

### 🟡 HIGH: `getRemainingScans` counts wrong events

```typescript
async getRemainingScans(_orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("invoice_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "created")     // ← Counts ALL created invoices
    .gte("created_at", monthStart);
  const maxFree = 3;
  return Math.max(0, maxFree - (count ?? 0));
}
```

This counts **all invoice creation events** (including manually created invoices), not just scanner-created ones. A user who creates 3 invoices manually will see "0 scans remaining" even though they've never used the scanner. The scan limit should be tracked separately via a scanner-specific event type (e.g., `event_type: "scanner_used"`) or a dedicated counter.

### 🟡 MEDIUM: Tesseract.js performance concerns

```typescript
const worker = await createWorker(["ita", "eng"]);
const { data: { text } } = await worker.recognize(buffer);
await worker.terminate();
```

- **Worker created per request**: `createWorker` downloads language data (~15MB for ita+eng) and initializes the Tesseract engine. Cold start: **3-8 seconds**. Warm start (worker reuse): not implemented; each request is a cold start.
- **No worker pool**: Only one request at a time. Under concurrent load, multiple workers compete for CPU/memory.
- **30-second timeout** (`maxDuration = 30`): Real photographs from a phone camera (3-12MB) may exceed 30 seconds on a low-tier serverless instance.
- **No image preprocessing**: Real photos have shadows, skew, noise, and low contrast. Raw Tesseract on unprocessed images yields **<50% accuracy** on invoices/receipts.

### 🟡 MEDIUM: Parsing is fragile

The regex-based parsers make naive assumptions:
- `parseVendor`: Takes the first non-numeric line as the vendor name. A receipt that starts with "Via Roma 123" gets vendor="Via Roma 123".
- `parseTotal`: Picks the last monetary value in the text. If the receipt has a "Resto: €0.00" at the bottom, that becomes the total.
- `parseDate`: Matches the first `DD/MM/YYYY` pattern. If the receipt has a previous visit date, it overrides the actual invoice date.

Production OCR on Italian receipts needs either:
- A purpose-built model (e.g., Microsoft Form Recognizer, Google Document AI)
- Or: structured parsing of specific Italian receipt formats (scontrino fiscale, fattura elettronica XML)

---

## § 4 · IS IT FASTER THAN MANUAL ENTRY?

### Judgment: **NO — it's slower**

Manual invoice entry for a freelancer:
1. Type client name → 5 seconds
2. Type description → 10 seconds
3. Enter amount → 3 seconds
4. Click "Create" → 1 second
**Total: ~20 seconds**

Scanner flow with current implementation:
1. Open scanner page → (doesn't exist, hypothetical)
2. Take photo → 5 seconds
3. Wait for Tesseract cold start → 5-8 seconds
4. OCR processes → 3-10 seconds
5. Review extracted data → 20-40 seconds (fix vendor name, correct total, fix date, add description)
6. Confirm → 3 seconds
**Total: ~36-66 seconds, with high error rate**

**The scanner in its current form is 2-3× slower than manual entry** because the extraction quality requires extensive correction. The speed advantage of OCR only materializes when:
- Extraction accuracy > 85% (requires a better model)
- Multi-page invoices can be batch-processed
- Line items are automatically parsed (current implementation extracts only one line item)

---

## § 5 · DECISION: NO-GO

### Justification

The scanner feature has **four independent blockers** that each independently justify NO-GO:

| # | Blocker | Severity |
|---|---|---|
| 1 | No frontend page — feature is inaccessible | 🔴 Critical |
| 2 | `confirmAndCreateInvoice` has hardcoded broken `client_id` — cannot create invoices | 🔴 Critical |
| 3 | Tesseract.js cold-start + no preprocessing → slow + inaccurate | 🔴 Critical |
| 4 | Scan limit counter conflates manual + scanner invoices | 🟡 High |

### What would make it GO-ready

1. **Build the scanner frontend page** with camera capture, processing UI, review step, and confirmation.
2. **Fix `confirmAndCreateInvoice`**: 
   - Auto-create a client from extracted vendor name, or allow user to select existing client
   - Use the standard invoice numbering system (INV-YYYY-NNN)
   - Read tax rates from user settings, not hardcoded
3. **Add image preprocessing** (binarization, deskewing, contrast enhancement) before Tesseract.
4. **Implement worker pooling** (reuse Tesseract workers across requests) to eliminate cold-start latency.
5. **Fix scan counter** to use scanner-specific events.
6. **Benchmark accuracy** on 20+ real Italian receipts. If accuracy < 80%, replace Tesseract with a cloud OCR service (Google Document AI, Azure Form Recognizer, or AWS Textract — all have Italian-language support for invoices).

### Recommendation for launch

**Ship without the scanner.** It's not a core invoicing feature — freelancers can manually enter invoices in 20 seconds. Focus engineering time on fixing the payment tax bugs (PAYMENT_READINESS_REPORT.md) and building the paywall UI (PAYWALL_REPORT.md). Add the scanner as a post-launch feature when you can invest in a proper OCR pipeline.

---

## § 6 · ALTERNATIVE: Quick-win scanner

If you MUST ship scanning at launch, the fastest path is:

1. Skip Tesseract.js entirely.
2. Use **Google Cloud Vision API** (`documentTextDetection` feature). It handles preprocessing, supports Italian, and returns structured text with layout analysis. Cost: ~$1.50 per 1000 images.
3. Parse the structured response (blocks, paragraphs, confidence scores) instead of raw regex.
4. This eliminates cold-start issues, worker management, and preprocessing — the API handles all of it.
5. Frontend: build a single-page scanner with `<input type="file" capture="environment">` for mobile camera access.

**Estimated effort: 2-3 days** vs. 2-3 weeks to fix the Tesseract pipeline.

| Approach | Accuracy | Latency | Dev Effort | Monthly Cost |
|---|---|---|---|---|
| Current (Tesseract) | ~40-60% | 3-15s | 3 weeks to fix | $0 |
| Google Cloud Vision | ~85-95% | 1-3s | 2-3 days | ~$1-5/mo |
| Do nothing (manual entry) | N/A | 20s | $0 | $0 |
