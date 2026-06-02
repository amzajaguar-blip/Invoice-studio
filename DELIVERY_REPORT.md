# V22 DELIVERY REPORT — PDF Generation / Download / Email
**Audit date:** 2026-06-02  
**Auditor:** BillingEngineer (automated audit)  
**Classification key:** 🟢 READY · 🟡 PARTIAL · 🔴 BLOCKED

---

## § 1 · PDF GENERATION

### Classification: 🟢 READY (with 🟡 caveats)

**Files:**
- `frontend/src/app/api/invoices/[id]/pdf/route.ts` — API endpoint
- `frontend/src/lib/pdf/InvoicePDF.tsx` — PDF component & renderer

### What works
- Uses `@react-pdf/renderer` (mature, well-maintained library) ✅
- `renderToBuffer` renders server-side — no browser dependency ✅
- Proper A4 page layout with professional formatting ✅
- Italian tax breakdown: Imponibile → IVA → Ritenuta d'acconto → Totale ✅
- Status badge (Bozza/Inviata/Scaduta/Pagata) rendered on PDF ✅
- Party details: Emessa da / Intestata a ✅
- Line items table with description, quantity, price, total ✅
- Notes section rendered when present ✅
- Footer with support email ✅
- Correct HTTP headers:
  ```
  Content-Type: application/pdf
  Content-Disposition: inline; filename="Fattura_INV-2026-001.pdf"
  Cache-Control: public, max-age=3600
  ```
  ✅
- Owner-only access (org_id check) ✅
- `invoice_events` log (event_type: "viewed") ✅

### Issues

#### 🟡 MEDIUM: Google Fonts CDN dependency
```typescript
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf", fontWeight: 700 },
  ],
});
```
If `fonts.gstatic.com` is unreachable (Google CDN outage, network issue, or firewalled environment), **PDF generation fails entirely.** The font is fetched on every first render (cached in memory via `fontsRegistered` flag, but not across serverless cold starts).

**Fix:** Bundle Inter font files locally in the project (2 TTF files, ~500KB total). Remove the CDN dependency.

#### 🟡 LOW: No PDF caching
Every request regenerates the PDF from scratch via `renderToBuffer`. For frequently-viewed invoices, this wastes CPU. Consider:
- Cache the PDF buffer keyed by `invoiceId + updated_at` hash for 1 hour
- Invalidate on invoice update (status change, payment received)

#### 🟡 LOW: Font weight URLs are version-pinned
```typescript
`https://fonts.gstatic.com/s/inter/v18/...`
```
When Google updates Inter to v19+, these URLs may 404. Mitigated by the fact that Google keeps old versions for years, but worth noting.

---

## § 2 · PDF DOWNLOAD

### Classification: 🟢 READY

The PDF is served with `Content-Disposition: inline`. This means:
- Browsers display the PDF in a viewer tab ✅
- Users can click "Download" from the browser's PDF viewer ✅
- No separate download endpoint needed ✅

If a `Content-Disposition: attachment` variant is desired (force download), it's a one-line change in the route. Current inline behavior is reasonable for invoices.

---

## § 3 · EMAIL SENDING

### Classification: 🟡 PARTIAL

**Files:**
- `frontend/src/app/api/invoices/[id]/send-email/route.ts` — API endpoint
- `frontend/src/lib/email/resend.ts` — Resend client & template

### What works
- Resend SDK integration ✅
- Lazy initialization pattern (build-safe) ✅
- Proper HTML email template with:
  - InvoiceStudio branding ✅
  - Invoice number, client name, total, due date ✅
  - CTA button ("Paga ora con Carta") → payment link ✅
  - Notes section when present ✅
  - Privacy/Terms footer links ✅
  - `escapeHtml` on all user data (XSS prevention) ✅
- Invoice ownership verification before sending ✅
- Requires payment_link to exist before sending ✅
- Automatic 7-day-before-due reminder scheduling ✅
- `invoice_events` audit log ✅
- `RESEND_FROM_EMAIL` env var for custom sender ✅

### Issues

#### 🟡 MEDIUM: Resend sandbox limitation
```typescript
function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "InvoiceStudio <onboarding@resend.dev>";
}
```
The fallback sender `onboarding@resend.dev` is Resend's **sandbox-only sender**. It can only deliver emails to the email address that owns the Resend account. **No real client will receive emails** unless `RESEND_FROM_EMAIL` is set to a verified domain (`invoicestudio.app` or similar).

This means: **email delivery is currently dead for all real recipients** unless the env var is configured correctly and the domain is verified on Resend.

To verify a domain on Resend:
1. Add DNS records (MX, DKIM, SPF) for `invoicestudio.app`
2. Set `RESEND_FROM_EMAIL="InvoiceStudio <fatture@invoicestudio.app>"`
3. Test delivery to an external address

#### 🟡 LOW: No retry on send failure
```typescript
const { data, error } = await getResend().emails.send({...});
if (error) { throw error; }
```
If Resend's API is temporarily unavailable, the request fails immediately. The calling API route returns 500. No retry with backoff.

#### 🟡 LOW: No email-sent verification
The endpoint returns `{ sent: true }` immediately after Resend accepts the request. Resend's acceptance doesn't guarantee delivery. No delivery webhook is configured to track bounces/complaints.

---

## § 4 · END-TO-END DELIVERY FLOW ASSESSMENT

```
Freelancer views invoice → clicks "Scarica PDF" → PDF opens in browser → ✅
Freelancer clicks "Invia email" → email sent to client → ⚠️ (sandbox only)
Client receives email → clicks "Paga ora" → pay page opens → ✅ (after tax fix)
Client pays → webhook fires → invoice marked paid → ✅
Freelancer notified of payment → ❌ (no notification)
```

---

## § 5 · SUMMARY TABLE

| Component | Status | Notes |
|---|---|---|
| PDF generation | 🟢 READY | Works; bundle fonts to remove CDN dep |
| PDF download | 🟢 READY | Inline display with browser download option |
| Email sending (code) | 🟢 READY | Template, escaping, error handling all sound |
| Email sending (delivery) | 🟡 PARTIAL | Sandbox-only unless RESEND_FROM_EMAIL is set |
| Freelancer payment notification | 🔴 BLOCKED | No notification when invoice is paid |
| Reminder scheduling | 🟢 READY | 7-day-before-due auto-reminder |
| **Overall — PDF** | **🟢 READY** | Production-ready with minor font hardening |
| **Overall — Email** | **🟡 PARTIAL** | Code works; domain verification needed for delivery |

---

## § 6 · REQUIRED FIXES

### P0 — BLOCKING
None — PDF works, email code works. But email will NOT deliver to real clients until domain is verified.

### P1 — HIGH
1. **Verify `invoicestudio.app` domain on Resend** and set `RESEND_FROM_EMAIL` in production.
2. **Bundle Inter font files locally** to remove Google CDN dependency from PDF generation.
3. **Add payment notification email** to Stripe webhook: when invoice is paid, send confirmation to the freelancer.

### P2 — MEDIUM
4. Add retry with backoff to Resend API calls.
5. Configure Resend delivery webhooks to track bounces and complaints.
6. Add PDF caching (keyed by invoice ID + updated_at hash).
