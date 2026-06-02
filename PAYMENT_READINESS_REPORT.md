# V22 PAYMENT READINESS REPORT — Stripe / RevenueCat / Webhooks
**Audit date:** 2026-06-02  
**Auditor:** BillingEngineer (automated audit)  
**Classification key:** 🟢 READY · 🟡 PARTIAL · 🔴 BLOCKED

---

## § 0 · CONTEXT VERIFICATION

| Dimension | Resolved Value |
|---|---|
| Business model | B2C SaaS — Italian freelancer invoicing tool |
| Geography | Italy (EU) — IVA + ritenuta d'acconto tax model |
| Volume tier | Pre-launch (< $100K/mo) |
| Existing stack | Next.js 15 / Supabase / Stripe (Checkout) / RevenueCat / Resend |
| Risk tolerance | Startup — fast iteration, but money flow must be correct |

---

## § 1 · STRIPE CHECKOUT — GENERATE PAYMENT LINK

### Classification: 🔴 BLOCKED

**File:** `frontend/src/app/api/invoices/[id]/generate-payment-link/route.ts`

### What works
- Payment token generation with SHA-256 hashing ✅
- Token → DB → Stripe session creation order (rollback on failure) ✅
- Invoice ownership verification ✅
- Status guards (no pay on already-paid/cancelled invoices) ✅
- 30-day expiry on both token and Stripe session ✅
- `invoice_events` audit log ✅

### What's broken

#### 🔴 CRITICAL: Ritenuta d'acconto over-deducted from buyer
The line `stripeWithholdingRate = await getOrCreateStripeTaxRate(-invoice.withholding_tax_rate)` attempts to create a **negative tax rate** that subtracts 20% from the Stripe Checkout total. This is **wrong on two levels**:

1. **Conceptual**: Ritenuta d'acconto is the freelancer's income tax withholding — the CLIENT pays the full amount (subtotal + IVA) and the freelancer remits 20% to the tax authority separately. By deducting it from the checkout, you're undercharging the client by 20% of the imponibile.

2. **Technical**: Stripe's `tax_rates.percentage` has a minimum of 0 (non-negative). The `getOrCreateStripeTaxRate` function passes `Math.abs(percentage)` to create the rate, but it's attached as a negative line (`...stripeWithholdingRate ? [stripeWithholdingRate] : []`). The tax rate display_name says "Ritenuta d'acconto 20%" but the rate itself is positive. The checkout line-item calculation becomes `unit_amount` + IVA% + 20% (positive), **adding** instead of subtracting. Either way, the total is wrong.

**Correct behavior for Italian invoices**: The client pays **subtotal + IVA** in full through Stripe. The app records the ritenuta on the invoice for the freelancer's records, but does NOT adjust the payment amount.

#### 🔴 HIGH: `getOrCreateStripeTaxRate` pagination bug
```typescript
const existing = await stripe.taxRates.list({ active: true, limit: 1 });
const match = existing.data.find((tr) => tr.display_name === displayName);
```
`limit: 1` fetches **only one** tax rate. If the account has more than one active tax rate and the desired rate isn't the first one returned, the function **never finds it** and creates a duplicate on every call. This silently accumulates duplicate tax rates.

**Fix:** Use `stripe.taxRates.list({ active: true, limit: 100 })` or search by `display_name` metadata.

#### 🟡 MEDIUM: `stripe_pi_id` column semantic mismatch
The code stores `session.id` (a Checkout Session ID, e.g., `cs_xxx`) in a column named `stripe_pi_id` (PaymentIntent ID, `pi_xxx`). This is confusing for debugging and reconciliation.

### Recommendation
Remove ritenuta d'acconto from Stripe Checkout entirely. The buyer pays `subtotal + IVA`. Ritenuta is informational only on the invoice PDF. Fix the tax rate pagination.

---

## § 2 · STRIPE CHECKOUT — PUBLIC PAY PAGE

### Classification: 🔴 BLOCKED

**Files:**
- `frontend/src/app/pay/[token]/page.tsx`
- `frontend/src/app/pay/[token]/PayClient.tsx`
- `frontend/src/app/api/pay/[token]/route.ts`

### What works
- Token hash lookup, expiry check, used_at guard ✅
- Invoice display with line items, IVA, ritenuta breakdown ✅
- Success/cancelled/expired/already-paid states all handled ✅
- Clean UI with loading, error, disabled states ✅
- `robots: { index: false, follow: false }` — good for payment pages ✅
- Fresh Stripe session generation in POST route ✅

### What's broken

#### 🔴 CRITICAL: Tax NOT applied on fresh sessions
The `POST /api/pay/[token]` route creates a **new** Stripe Checkout session but does NOT apply tax rates to line items:
```typescript
const session = await stripe.checkout.sessions.create({
  // ...
  line_items: lineItems,  // ← NO tax_rates!
  // ...
});
```
Compare with `generate-payment-link` which applies `tax_rates: [...]`. If a client pays through the public pay page, **IVA is not charged**. The freelancer loses 22% on every payment.

#### 🟡 MEDIUM: Two different checkout paths
Having two separate Stripe session creation paths (one in `generate-payment-link`, one in `pay/[token]/route`) means:
- Bug fixes must be applied in **two places**
- Different expiry times (30 days vs. 24 hours)
- Different tax handling
- `generate-payment-link` includes tax rates; `pay/[token]` doesn't

#### 🟡 MEDIUM: Token exposed in client-side fetch
`PayClient.tsx` passes the raw payment token in the URL as a path parameter (`/api/pay/${token}`). While the token is server-verified by hash, exposing it in browser network logs is unnecessary.

### Recommendation
Extract Stripe session creation into a shared function used by both routes. Apply IVA tax rates consistently on both paths. Remove ritenuta from payment amount on both.

---

## § 3 · STRIPE WEBHOOK

### Classification: 🟢 READY (with 🟡 caveats)

**File:** `frontend/src/app/api/webhooks/stripe/route.ts`

### What works
- Stripe signature verification (HMAC-SHA256) ✅
- Missing signature → 400 with audit log ✅
- Invalid signature → 400 (no PII in logs) ✅
- UUID format validation for invoice_id ✅
- Idempotency guard (`existingInvoice?.status === "paid"`) ✅
- Invoice `status: "paid"` + `paid_at` timestamp ✅
- Payment token `used_at` marking ✅
- `checkout.session.expired` handler with safe reset ✅
- `invoice_events` audit log ✅
- `logPaymentAudit` for PCI-DSS compliance ✅
- Rate limiting (60/min) ✅
- Unknown event types gracefully handled ✅

### Issues

#### 🟡 MEDIUM: No email notification on payment
When a webhook marks an invoice as paid, the freelancer is NOT notified. They have to manually check the dashboard. Should fire an internal event or call `sendInvoiceEmail` with a "paid" notification template.

#### 🟡 MEDIUM: DB update failure is unrecoverable
If the `invoices.update({ status: "paid" })` fails, the Stripe webhook returns 500. Stripe will retry with exponential backoff, but the idempotency guard only checks `status === "paid"` — if the update partly succeeded (token marked used but invoice not paid), the next retry will skip because `used_at` is set but `status` is still "sent". Actually, the order is: invoice update first, then token update. So if invoice update fails, token is never marked used and the idempotency gate passes on retry. This is acceptable.

#### 🟡 LOW: In-memory rate limiter
The rate limiter is in-memory (Map-based). In multi-instance deployments, rate limits are per-instance, not global. For pre-launch this is fine; for production, migrate to Redis.

---

## § 4 · REVENUECAT WEBHOOK (Subscriptions)

### Classification: 🟢 READY (with 🟡 caveats)

**File:** `frontend/src/app/api/webhooks/revenuecat/route.ts`

### What works
- Bearer token authorization validation ✅
- UUID format validation for org_id ✅
- Organization existence check before updating ✅
- Event → plan mapping: INITIAL_PURCHASE/RENEWAL/UNCANCELLATION → "pro" ✅
- Event → plan mapping: EXPIRATION/BILLING_ISSUE → "free" ✅
- CANCELLATION handled correctly (maintains pro until EXPIRATION) ✅
- Audit logging (payment_audit_logs) ✅
- Rate limiting ✅
- Graceful handling of unknown event types ✅

### Issues

#### 🟡 MEDIUM: No idempotency on event replay
RevenueCat may deliver the same event multiple times. The webhook has **no event ID deduplication**. If `INITIAL_PURCHASE` is delivered twice, the org gets updated to pro twice (harmless but wasteful). Worse: if `BILLING_ISSUE` fires and is replayed, it sets the plan to free — then if a renewal event also fires and is replayed, it bounces back to pro. Without event deduplication, race conditions between replayed events can cause incorrect plan state.

**Fix:** Store processed `event.id` or a composite `(event_type, app_user_id, purchased_at_ms)` hash in a deduplication table. Check before processing.

#### 🟡 MEDIUM: PRODUCT_CHANGE and SUBSCRIPTION_PAUSED ignored
- `PRODUCT_CHANGE` (upgrade from monthly → annual or vice versa): No plan change is applied. The plan stays at whatever it was. Should at minimum **verify** the current entitlement is still "pro" and log the change.
- `SUBSCRIPTION_PAUSED`: No action taken. User continues with pro access during pause. Should at least **log** the pause state for dashboard display.

#### 🟡 LOW: Bearer token auth is adequate but HMAC is stronger
RevenueCat supports HMAC-SHA256 webhook signatures. Bearer token is sufficient but less secure than HMAC for webhooks that can originate from RevenueCat's infrastructure.

---

## § 5 · END-TO-END MONEY FLOW ASSESSMENT

```
Freelancer creates invoice → generates payment link → client receives email →
client clicks pay → Stripe Checkout → pays → webhook marks invoice paid →
RevenueCat tracks freelancer subscription (separate flow)
```

**Can a freelancer get paid?**  
**Answer: YES — IF IVA is 0% and your Stripe account is in test mode.**

If the freelancer charges IVA (22% standard Italian rate), the public pay page (`/pay/[token]`) **omits tax** on freshly created sessions, so the payment is short by 22%. If the client pays through the generated link directly (the one created in `generate-payment-link`), IVA is applied but ritenuta is double-applied as a positive surcharge, inflating or deflating the total.

### Summary Table

| Component | Status | Blocker? |
|---|---|---|
| Generate payment link | 🔴 BLOCKED | Ritenuta logic broken; wrong payment amount |
| Public pay page | 🔴 BLOCKED | IVA not applied on fresh sessions |
| Stripe Webhook | 🟢 READY | No (minor: no freelancer notification) |
| RevenueCat Webhook | 🟢 READY | No (minor: no event dedup) |
| **Overall** | **🔴 BLOCKED** | **Tax calculation is wrong; money flow incorrect** |

---

## § 6 · REQUIRED FIXES BEFORE LAUNCH

### P0 — BLOCKING

1. **Remove ritenuta d'acconto from Stripe payment amount.** Buyer always pays subtotal + IVA. Ritenuta is display-only on invoices.
2. **Apply IVA tax rates in `POST /api/pay/[token]`.** Extract session creation to a shared function.
3. **Fix `getOrCreateStripeTaxRate` pagination.** Pass `limit: 100` or use metadata search.

### P1 — HIGH

4. Add email notification to freelancer when webhook marks invoice paid.
5. Add RevenueCat event ID deduplication.
6. Handle PRODUCT_CHANGE event (at minimum, verify + log).

### P2 — MEDIUM

7. Rename `stripe_pi_id` to `stripe_session_id` (or make it explicitly a session ID).
8. Migrate rate limiter to Redis before multi-instance deployment.
