# V22 PAYWALL REPORT — Free Plan Limit Verification & Upgrade Flow
**Audit date:** 2026-06-02  
**Auditor:** BillingEngineer (automated audit)

---

## § 0 · THE LIMIT

### Actual free plan quota: **5 invoices/month**

Source: `frontend/src/types/rewards.ts`, line 52:
```typescript
free: {
  maxInvoices: 5,
  maxRewardedCredits: 300,
  maxDailyRewardedCredits: 10,
  rewardedAdsEnabled: true,
  unlimited: false,
},
```

Not 3. **5 invoices per calendar month.** Confirmed in `getUserQuota()` via `getCurrentMonthInvoiceCount()`.

### Rewarded ads add-on
- Free users can earn up to **300 additional invoice credits per month** via rewarded ads
- Daily cap: **10 credits**
- Credits are consumed automatically when invoice count exceeds 5
- Idempotency: each invoice consumes at most 1 credit, enforced by `UNIQUE(idempotency_key)` on `credit_transactions`

---

## § 1 · SERVER-SIDE ENFORCEMENT

### Classification: 🟢 READY

**File:** `frontend/src/app/api/invoices/route.ts` (POST handler)

### What works
- `getUserQuota(orgId)` called **before** any invoice data is processed ✅
- Returns HTTP **402 Payment Required** when `canCreateInvoice === false` ✅
- Response includes detailed quota breakdown:
  ```json
  {
    "error": "Limite fatture raggiunto",
    "quota": { "plan": "free", "planLimit": 5, "currentMonthInvoices": 5, ... },
    "code": "PLAN_LIMIT" | "PLAN_LIMIT_HARD"
  }
  ```
  ✅
- Rate limiting on invoice creation (30/min per user) ✅
- Zod validation BEFORE quota check (good) — catches bad requests cheaply ✅
- Automatic rewarded credit consumption when over base limit ✅
- Credit consumption is idempotent (per-invoice unique key) ✅
- Credit consumption recorded in `credit_transactions` ledger ✅
- Invoice creation is atomic with rollback on line-item failure ✅
- Invoice number generation retries on race condition (up to 3) ✅

### Issues

#### 🟡 MEDIUM: 402 response includes no upgrade URL
The API returns quota details but **no `upgrade_url` or pricing info**. The frontend receives `{ error, quota, code }` but nothing to tell the user HOW to upgrade. The client must discover the upgrade path independently.

**What the response should include:**
```json
{
  "error": "Limite fatture raggiunto",
  "code": "PLAN_LIMIT",
  "upgrade": {
    "url": "/settings/billing",
    "plans": [
      { "name": "Pro", "price": "€4.99/mese", "features": ["Fatture illimitate", ...] }
    ]
  }
}
```

#### 🟡 LOW: No check for `REVENUECAT_WEBHOOK_SECRET` at startup
If RevenueCat webhook secret is missing, the webhook silently fails. Consider adding a startup healthcheck or an env validation in `instrumentation.ts`.

---

## § 2 · FRONTEND ENFORCEMENT & UX

### Classification: 🔴 BLOCKED

### What exists: NOTHING

The invoices dashboard page (`frontend/src/app/(dashboard)/invoices/page.tsx`) and its `InvoicesView` component were searched for:
- `upgrade` — **0 matches**
- `PLAN_LIMIT` — **0 matches**
- `quota` — **0 matches**
- `402` — **0 matches**
- `paywall` — **0 matches**
- `free.*limit` — **0 matches**

**There is no paywall UI.** The frontend does not:
1. Display remaining invoice quota to free users ❌
2. Handle the 402 response and show an upgrade prompt ❌
3. Show a "You've used X of 5 invoices" progress indicator ❌
4. Link to a billing/settings page where users can upgrade ❌
5. Show rewarded ad progress or "watch an ad to unlock" CTA ❌

### What the user sees when they hit the limit:
The API returns 402, and the frontend likely shows whatever generic error handling exists in the invoice creation component. Given the absence of any limit-aware code, the user probably sees a raw error message or a generic toast with no clear action path.

---

## § 3 · UPGRADE FLOW

### Classification: 🔴 BLOCKED

### Path to Pro

1. **Mobile (Google Play):** RevenueCat handles the subscription. Product IDs: `mensile` (€4.99/mo) and `annuale` (€49.99/yr). RevenueCat webhook updates org.plan to "pro" on INITIAL_PURCHASE.
2. **Web:** **No web upgrade path exists.** There is no:
   - Billing/settings page with plan selection
   - Stripe Checkout for web subscriptions
   - RevenueCat web SDK integration (RevenueCat can handle web too)
   - Link from paywall to any upgrade page

**RevenueCat entitlement:** `pro`  
**Products defined in Google Play only.** No web/Stripe subscription products exist.

### What happens when a free user upgrades on mobile:
1. User subscribes via Google Play Billing → RevenueCat processes
2. RevenueCat fires `INITIAL_PURCHASE` webhook → `/api/webhooks/revenuecat`
3. `organizations.plan` is updated from `free` to `pro`
4. `getUserQuota()` picks up the change → `unlimited: true`
5. User can now create unlimited invoices

✅ **The backend upgrade path works.** The frontend just doesn't connect to it.

---

## § 4 · REWARDED ADS FLOW

### Classification: 🟢 READY (backend) / 🔴 BLOCKED (frontend)

### Backend infrastructure (from `plan.ts`)

- `getRewardedCredits()` — reads from unified `org_credits` wallet ✅
- `grantRewardedCredit()` — atomic credit grant with:
  - `ad_impressions` idempotency gate (UNIQUE on verification_hash) ✅
  - Daily limit enforcement (resets at midnight UTC) ✅
  - Credit cap enforcement (300 max) ✅
  - `credit_transactions` ledger entry ✅
- `consumeRewardedCredit()` — atomic credit consumption with:
  - Per-invoice idempotency (UNIQUE on idempotency_key) ✅
  - `org_credits.consumed_credits` increment ✅
  - `credit_transactions` ledger entry ✅
  - `invoice_events` backward compatibility ✅

### What's missing on the frontend
- No "watch ad" button anywhere
- No credit balance display
- No `admob_callback_id` generation or SSV flow from the web client
- The `showRewardedAdOption` field in `UserQuota` is computed correctly but **never read by any UI component**

---

## § 5 · PRO PLAN VERIFICATION

### Can a pro user be accidentally limited?

**No.** The `getUserQuota()` function checks `quota.unlimited` first:
```typescript
if (quota.unlimited) {
  return { ...canCreateInvoice: true, unlimited: true, ... };
}
```
All unlimited plans (pro, agency, enterprise) bypass the invoice count check entirely. ✅

### Can a pro user accidentally get downgraded?

**Only if the RevenueCat webhook fires `EXPIRATION` or `BILLING_ISSUE`.** The webhook sets `organizations.plan = "free"` unconditionally on those events. If a pro user's subscription expires, they are correctly downgraded. There's no grace period — it's immediate.

---

## § 6 · SUMMARY

| Area | Status | Details |
|---|---|---|
| Server-side limit enforcement | 🟢 READY | 5 invoices/mo, 402 response, credit consumption |
| Quota calculation | 🟢 READY | Correctly computes base + rewarded capacity |
| Rewarded ads backend | 🟢 READY | Full idempotent credit lifecycle |
| Frontend paywall UI | 🔴 BLOCKED | No quota display, no upgrade CTA, no limit warning |
| Web upgrade path | 🔴 BLOCKED | No billing page, no Stripe subscription for web |
| Mobile upgrade path | 🟢 READY | RevenueCat → webhook → plan update works |
| **Overall** | **🔴 BLOCKED** | **Backend enforces correctly; frontend gives zero user feedback** |

---

## § 7 · REQUIRED FIXES

### P0 — BLOCKING
1. **Add quota display** to the invoices dashboard: "You've used 4/5 invoices this month" with a progress bar.
2. **Handle 402 in invoice creation UI**: Show an upgrade modal/prompt when the limit is reached.
3. **Create a billing/settings page** with plan comparison and an upgrade button (Stripe Checkout for web + link to Google Play for mobile).
4. **Include `upgrade_url` in 402 API response.**

### P1 — HIGH
5. Add rewarded ad "watch ad to unlock" UI for free users at their limit.
6. Add credit balance display in the dashboard.

### P2 — MEDIUM
7. Add grace period handling for RevenueCat BILLING_ISSUE (e.g., 3 days before downgrade).
8. Add env validation at startup for critical payment secrets.
