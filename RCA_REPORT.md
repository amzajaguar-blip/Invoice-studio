# RCA REPORT

**Date**: 2026-05-25
**Analyst**: Forensic debugger (Principal Engineer)
**Repository**: InvoiceStudio mobile app

---

## SECTION A: ProUpgrade Paywall v10 — Root Cause Analysis

### Executive Summary (ProUpgrade)

The ProUpgrade paywall screen contains **7 P0, 3 P1, 2 P2, and 1 P3 findings** across 2 files. The paywall is structurally non-functional: it displays fake prices, has no connection to RevenueCat, cannot initiate purchases, and would crash on its first real invocation. Critically, it shows a different price (€4.99) than the modal that leads to it (€19) — a legal/compliance risk under EU consumer protection law.

---

### A.3.1 Root Cause Chain — 5 Whys

#### Critical Path A: "User taps 'Attiva Abbonamento' and gets fake alert instead of purchase flow"

**Symptom**: Tap CTA → spinner for 1.5s → "In arrivo!" alert → no purchase.

**Why 1**: `handleSubscribe` executes a `setTimeout` stub instead of calling RevenueCat.
→ **Why 2**: The `Purchases.purchasePackage()` call is commented out because RevenueCat was never initialized.
→ **Why 3**: `Purchases.configure()` is never called anywhere in the codebase — no API key, no observer mode setup, no entitlement mapping.
→ **Why 4**: The ProUpgrade screen was built as a UI prototype without the backend purchase pipeline being ready, and the stub was never flagged with an expiration date or block.
→ **Why 5 (root cause)**: **The paywall's definition of "done" was visual, not functional.** There was no integration test proving the screen could complete a purchase end-to-end. A `BLOCKED` label or `TODO(revenuecat)` comment should have been attached, with a CI gate preventing merge without it being resolved.

#### Critical Path B: "Price mismatch between InvoiceLimitModal (€19) and ProUpgrade (€4.99)"

**Symptom**: Modal advertises "Passa a Pro — €19/mese", tap navigates to ProUpgrade showing "€ 4,99/mese".

**Why 1**: Prices are hardcoded independently in two files with no shared constant or config source.
→ **Why 2**: There is no centralized pricing configuration — neither in RevenueCat (never configured) nor in an app-level constants file.
→ **Why 3**: The two screens were likely built by different contributors or at different times without a shared spec.
→ **Why 4**: The true price is ambiguous because RevenueCat `getOfferings()` was never integrated, so the marketing price (€19 in modal) and the paywall price (€4.99 in ProUpgrade) diverged.
→ **Why 5 (root cause)**: **No single source of truth for pricing exists.** RevenueCat is the canonical source (reads from Google Play Console), but no code reads from it.

#### Critical Path C: "When real RevenueCat code is uncommented, app crashes on first purchase attempt"

**Symptom**: Uncomment `Purchases.purchasePackage(packageToBuy)` → `ReferenceError: packageToBuy is not defined`.

**Why 1**: The commented-out code references a variable `packageToBuy` that is never declared.
→ **Why 2**: The `packages` array items are local UI objects (`{ id, title, price, desc }`), not RevenueCat `Package` objects. There's no mapping from selected plan to a RevenueCat offering.
→ **Why 3**: The commented code was written as a rough sketch and never validated against the RevenueCat SDK API.
→ **Why 4**: RevenueCat's `getOfferings()` returns `Offerings` → `Offering` → `Package[]` — a completely different data model than the hardcoded `packages` array.
→ **Why 5 (root cause)**: **Code was written as pseudocode without ever running against the SDK.** TypeScript couldn't catch this because the import is commented out, removing all type checking.

---

### A.3.2 Detailed Findings

#### A-F1: Non-functional paywall stub [P0]

**Evidence** — `ProUpgrade.tsx` lines 18-30:
```typescript
const handleSubscribe = async () => {
  setLoading(true);
  // Qui andrà il vero codice: [...]
  setTimeout(() => {
    setLoading(false);
    Alert.alert("In arrivo!", "La connessione a Google Play Billing sarà attiva...");
  }, 1500);
};
```

The entire purchase function is a stub. It:
- Shows a 1.5s spinner to simulate work
- Displays a misleading alert implying purchases will work after Google Console approval
- **Never calls RevenueCat or Google Play Billing**
- Resets `loading` to false, re-enabling the button for another fake attempt

**Impact**: 100% of users who try to subscribe get a fake experience. Revenue = €0.

#### A-F2: `Purchases.configure()` never called [P0]

**Evidence**: Grep of entire `mobile/` directory for `Purchases.configure` returns zero matches. The SDK (`react-native-purchases: ^10.1.2`) is installed (in `package.json` line 34) but never initialized. RevenueCat requires `Purchases.configure({ apiKey, appUserID, ... })` at app startup.

**Impact**: Even uncommenting the import would crash with `PurchasesNotConfiguredError`. Purchase flow is impossible.

#### A-F3: Price mismatch across screens [P0]

**Evidence**:
- `InvoiceLimitModal.tsx` line 207: `<Text style={s.proBtnTitle}>Passa a Pro — €19/mese</Text>`
- `ProUpgrade.tsx` line 14: `{ id: "monthly", title: "Mensile", price: "€ 4,99", ... }`
- `ProUpgrade.tsx` line 15: `{ id: "yearly", title: "Annuale", price: "€ 49,99", ... }`

Three different price points for the same product. Under EU Directive 2005/29/EC (Unfair Commercial Practices), this is a **misleading action** — the invitation to purchase must match the actual price.

**Impact**: Google Play Store rejection; potential consumer complaint; confusing UX.

#### A-F4: `packageToBuy` is undefined [P0]

**Evidence** — `ProUpgrade.tsx` line 22 (commented-out):
```typescript
// const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
```

`packageToBuy` is never declared, never assigned. It would throw `ReferenceError` at call time. The fix requires:
1. Fetching real RevenueCat offerings via `Purchases.getOfferings()`
2. Mapping `selectedPlan` to the correct `Package` object from the offering
3. Passing that `Package` to `Purchases.purchasePackage()`

#### A-F5: No `setLoading(false)` in catch block [P0]

**Evidence** — `ProUpgrade.tsx` lines 23-24 (commented-out):
```typescript
// } catch (e) { Alert.alert("Errore", e.message); }
```

After any error (network, cancellation, billing unavailable), `loading` stays `true` forever. The CTA button is permanently disabled. User must kill the app to recover.

**Additionally**: `e.message` may be `undefined` if RevenueCat throws a non-Error object (some native modules throw plain objects). The alert would show "Errore" with no detail.

#### A-F6: No double-tap guard [P1]

The CTA button is disabled via `disabled={loading}`, but:
- The `loading` state is set asynchronously (`setLoading(true)` before `await`)
- React state batching means a second tap could arrive before the re-render disabling the button
- With real RevenueCat code, this could trigger `purchasePackage()` twice → double charge or "already purchased" error

**Fix**: Add a ref-based guard: `const purchasingRef = useRef(false)`.

#### A-F7: Cancel button active during purchase [P1]

```typescript
<TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
```

This button has no `disabled={loading}` prop. While the purchase is processing:
- User can tap "Forse più tardi" → `router.back()` fires
- Purchase may complete in background → user has paid but left the screen
- The success path (`router.back()`) executes again → double navigation

#### A-F8: No `clearTimeout` on unmount [P1]

```typescript
setTimeout(() => {
  setLoading(false);
  Alert.alert("In arrivo!", ...);
}, 1500);
```

If the user navigates away before the 1.5s timeout fires, `setLoading(false)` triggers a state update on an unmounted component → React warning in dev, noop in prod with new React, but the `Alert.alert()` would fire on a different screen (confusing).

#### A-F9: `selectedPlan` never read in purchase logic [P2]

The user selects "Mensile" or "Annuale" via `setSelectedPlan(pkg.id as any)`, but `handleSubscribe` never references `selectedPlan`. The CTA text updates cosmetically (`selectedPlan === "yearly" ? "Annuale" : "Mensile"`), but the purchase always defaults to whatever `packageToBuy` would be (which is undefined anyway).

#### A-F10: `as any` cast on `setSelectedPlan` [P2]

```typescript
onPress={() => setSelectedPlan(pkg.id as any)}
```

At runtime, `pkg.id` is always `"monthly" | "yearly"` (only two elements in the array), so this **won't crash**. But the `as any` silences TypeScript, hiding the fact that `packages[].id` is typed as `string` rather than the union. The proper fix is:

```typescript
const packages: { id: "monthly" | "yearly"; title: string; price: string; desc: string }[] = [...]
```

#### A-F11: Hardcoded prices — Google Play Billing policy violation [P0]

Google Play Developer Program Policies require:
> "The price displayed to users must match the price configured in Play Console for that product."

Hardcoded strings (`"€ 4,99"`, `"€ 49,99"`) will inevitably drift from Play Console configuration. RevenueCat's `getOfferings()` returns price strings formatted for the user's locale directly from Play Console — this is the only compliant approach.

#### A-F12: `packages` recreated every render [P3]

```typescript
const packages = [
  { id: "monthly", ... },
  { id: "yearly", ... }
];
```

This array is a new reference on every render, causing `packages.map(...)` to re-execute all JSX reconciliation even when nothing changed. Wrap in `useMemo` or move outside component.

---

### A.3.3 Causal Chain Diagram (ProUpgrade)

```
┌─────────────────────────────────────────────────────────────────────┐
│                ROOT CAUSE: Paywall "done" defined visually,         │
│                not functionally. No E2E purchase test.              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ RevenueCat SDK   │    │ No shared price      │    │ Pseudocode           │
│ installed but    │    │ source of truth      │    │ never validated      │
│ never configured │    │                      │    │ against RC SDK API   │
└────────┬────────┘    └──────────┬───────────┘    └──────────┬───────────┘
         │                        │                           │
         ▼                        ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ A-F2: No config │    │ A-F3: €19 vs €4.99   │    │ A-F4: packageToBuy   │
│ A-F1: Stub flow │    │   price mismatch     │    │   undefined          │
│ A-F11: No RC    │    │ A-F11: Hardcoded vs  │    │ A-F5: loading stuck  │
│   offerings     │    │   Play Console       │    │ A-F9: selectedPlan   │
│                 │    │                      │    │   ignored            │
└────────┬────────┘    └──────────┬───────────┘    └──────────┬───────────┘
         │                        │                           │
         └────────────────────────┼───────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  PRODUCTION IMPACT:       │
                    │  • Paywall is fake        │
                    │  • Zero subscription rev  │
                    │  • Legal/compliance risk  │
                    │  • Crashes if uncommented │
                    │  • User trust destroyed   │
                    └──────────────────────────┘
```

---

## SECTION B: Rewarded Ads Bug Hunt (2026-05-25 — prior analysis)

### Executive Summary (Rewarded Ads)

The Rewarded Ads implementation contains **8 P0, 6 P1, 6 P2, and 2 P3 findings**. The most critical issues stem from a **schema mismatch between two competing migration files** and an **architectural shortcut that bypasses server-side verification**, turning the credit system into a client-trusted, non-atomic, RLS-blocked pipeline that cannot deliver credits reliably — and if it could, would be trivially exploitable.

---

### B.3.1 Root Cause Chain (5 Whys)

### Critical Path: "User watches ad but receives no credit"

**Symptom**: EARNED_REWARD fires, `claimCredit()` executes, but no credit appears.

**Why 1**: The `claimCredit()` function's `supabase.from('org_credits').update(...)` call is rejected by Row Level Security.
→ **Why 2**: `migration-rewarded-ads.sql` defines only SELECT and INSERT policies for `org_credits`, not UPDATE.
→ **Why 3**: The RLS policies file (`migration_rls_policies.sql`) was written for a DIFFERENT schema (`rewarded_credits` / `reward_claims`) and was never updated for the ADR-003 schema (`org_credits` / `credit_transactions`).
→ **Why 4**: Two migration files exist — `migration_rewarded_ads.sql` (underscore, v1) and `migration-rewarded-ads.sql` (dash, v2/ADR-003) — and no reconciliation was performed before the hook was written.
→ **Why 5 (root cause)**: **No integration test ever exercised the full flow end-to-end using the anon-key client against a Supabase instance with RLS enabled.** If such a test existed, the RLS rejection would have been caught immediately.

### Second Critical Path: "Race condition causes lost credits"

**Symptom**: User watches 2 ads rapidly, only 1 credit appears.

**Why 1**: `claimCredit()` reads `existing.earned_credits` into JavaScript memory, increments it (`+1`), and writes it back. Between the read and write, another invocation can read the same stale value.
→ **Why 2**: No `SELECT ... FOR UPDATE` or atomic `SET earned_credits = earned_credits + 1` is used.
→ **Why 3**: The hook uses the Supabase JS client which doesn't support transactions — each `.update()` / `.insert()` is a separate HTTP request.
→ **Why 4**: The architecture document specifies a server-side `POST /api/ads/reward-claim` endpoint that would handle this atomically, but the mobile hook bypasses it entirely.
→ **Why 5**: The decision was made to call Supabase directly from the mobile client instead of routing through the server endpoint — either as an MVP shortcut or miscommunication.

### Third Critical Path: "Schema mismatch — which tables actually exist in production?"

**Root cause**: Two independent schema designs were committed without coordination:
- `migration_rewarded_ads.sql`: Uses `rewarded_credits(org_id, credits, max_credits, month_key)` and `reward_claims(verification_hash)`
- `migration-rewarded-ads.sql`: Uses `org_credits(earned_credits, consumed_credits)` and `credit_transactions(idempotency_key, entry_type, balance_after)`

The hook queries `org_credits` and `credit_transactions`. If the underscore migration was deployed, these tables **do not exist** and the hook fails on its first query. If the dash migration was deployed, the RLS policies are incomplete.

---

## 3.2 Causal Chain Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ROOT CAUSE: No E2E test with RLS                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ Competing       │    │ Hook bypasses server │    │ Hook written for     │
│ migration files │    │ verification API     │    │ synchronous, single- │
│ (v1 vs ADR-003) │    │ (ADR-003 §3.1)       │    │ user mental model    │
└────────┬────────┘    └──────────┬───────────┘    └──────────┬───────────┘
         │                        │                           │
         ▼                        ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ F1: RLS UPDATE  │    │ F4: Date.now()       │    │ F3: Non-atomic       │
│ policy missing  │    │ idempotency key      │    │ credit increment    │
│ F2: RLS INSERT  │    │ F5: No AdMob verify  │    │ F7: No transaction  │
│ policy missing  │    │ F13: No cooldown     │    │ F12: Stale closure  │
│ F8: Two schemas │    │ F14: enabled ignored │    │ F16: Memory leak    │
└────────┬────────┘    └──────────┬───────────┘    └──────────┬───────────┘
         │                        │                           │
         └────────────────────────┼───────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  PRODUCTION IMPACT:       │
                    │  Credits never delivered  │
                    │  OR delivered incorrectly │
                    │  No fraud protection      │
                    │  Zero ad revenue          │
                    └──────────────────────────┘
```

---

## 3.3 Timeline of Architecture Drift

| Date | Event | Impact |
|------|-------|--------|
| 2026-05-19 | `migration_rewarded_ads.sql` written (v1: `rewarded_credits` + `reward_claims`) | Baseline schema |
| 2026-05-19 | `migration_rls_policies.sql` written — matches v1 tables | RLS for v1 |
| 2026-05-19 | `architecture-rewarded-ads.md` completed (ADR-003) — specifies new schema (`org_credits` + `credit_transactions` + `ad_impressions`) | Architecture shifts |
| ~2026-05-19 | `migration-rewarded-ads.sql` written (v2/ADR-003) — new tables, inline RLS policies | New schema with partial RLS |
| ~2026-05-19-20 | `useRewardedInvoice.ts` written — coded against ADR-003 schema | Hook queries `org_credits` + `credit_transactions` |
| **2026-05-25** | **Bug hunt — reconciliation never performed** | **All gaps discovered** |

---

## 3.4 Impact Assessment

| Dimension | Assessment |
|-----------|------------|
| **Users affected** | 100% of free-plan users who attempt to watch rewarded ads |
| **Feature functionality** | Credits cannot be delivered (RLS blocked) or delivered incorrectly (race condition + no idempotency) |
| **Revenue impact** | Zero — test ad unit ID in production; even if fixed, no server-side verification means AdMob may reject impressions |
| **Security** | Trivially exploitable — client-side `Date.now() + Math.random()` as idempotency; no verification; no rate limiting |
| **Data integrity** | `org_credits` can diverge from `credit_transactions` ledger (non-atomic writes) |
| **Audit trail** | Broken — credit_transactions may miss entries or have duplicate keys |

---

## 3.5 Detailed Finding Documentation

### F1 — RLS: Missing UPDATE policy on `org_credits` [P0]

**Evidence**:
- `migration-rewarded-ads.sql` lines 33-38:
  ```sql
  CREATE POLICY "credits_tenant_select" ON public.org_credits FOR SELECT USING (...)
  CREATE POLICY "credits_tenant_insert" ON public.org_credits FOR INSERT WITH CHECK (...)
  -- NO UPDATE POLICY
  ```
- `useRewardedInvoice.ts` line 183-185:
  ```typescript
  await supabase.from('org_credits').update({ earned_credits: newEarned, ... }).eq('org_id', orgData.org_id);
  ```
- `supabase.ts` uses the anon key (not service_role) → all queries pass through RLS.

**Causal chain**: No UPDATE policy → UPDATE rejected by PostgreSQL RLS → `claimCredit()` fails silently → credit never granted.

### F2 — RLS: Missing INSERT policy on `credit_transactions` [P0]

**Evidence**:
- `migration-rewarded-ads.sql` line 103:
  ```sql
  CREATE POLICY "credit_tx_tenant_select" ON public.credit_transactions FOR SELECT USING (...)
  -- NO INSERT POLICY
  ```
- `useRewardedInvoice.ts` lines 191, 206:
  ```typescript
  await supabase.from('credit_transactions').insert({ ... });
  ```

**Causal chain**: No INSERT policy → INSERT rejected → ledger entry lost → audit trail broken.

### F3 — Race condition: Non-atomic `earned_credits` increment [P0]

**Evidence**: `useRewardedInvoice.ts` lines 178-186:
```typescript
const { data: existing } = await supabase
  .from('org_credits')
  .select('id, earned_credits, consumed_credits')
  .eq('org_id', orgData.org_id)
  .maybeSingle();

if (existing) {
  const newEarned = existing.earned_credits + 1;  // ← READ in JS
  await supabase
    .from('org_credits')
    .update({ earned_credits: newEarned, ... })    // ← WRITE back
    .eq('org_id', orgData.org_id);
```

**Reproduction**:
1. Open two ad instances (or simulate two rapid EARNED_REWARD events)
2. Both read `earned_credits = 3`
3. Both compute `newEarned = 4`
4. Both write `earned_credits = 4`
5. **Result**: 2 credits consumed, 1 granted. One credit lost.

**Fix**: Use atomic increment:
```typescript
await supabase.rpc('increment_earned_credits', { p_org_id: orgData.org_id, p_amount: 1 });
```
Or use Postgres function:
```sql
UPDATE org_credits SET earned_credits = earned_credits + 1 WHERE org_id = $1;
```

### F4 — Idempotency key uses `Date.now() + Math.random()` [P0]

**Evidence**: `useRewardedInvoice.ts` line 172:
```typescript
const idempotencyKey = `earn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
```

**Problems**:
1. `Math.random()` is not cryptographically secure (xorshift128+ in V8)
2. Two calls within the same millisecond have ~36^10 collision space — low but non-zero
3. **Architecture contract violation**: ADR-003 §3.1 specifies `earn_${admob_callback_id}_${orgId}` using the AdMob server-side verification token
4. No protection against replay — an attacker can fabricate earn claims with fresh timestamps
5. The AdMob callback IS available via the `RewardedAdEventType.EARNED_REWARD` event payload but is ignored

**The EARNED_REWARD event payload** (from `react-native-google-mobile-ads`) contains `reward.type` and `reward.amount` but the native AdMob SDK may provide a server-side verification token through a different API. This needs investigation.

### F5 — No server-side AdMob verification [P0]

**Evidence**: The entire `claimCredit()` function runs client-side and calls Supabase directly. Compare with ADR-003 §3.1 which specifies:
```
POST /api/ads/reward-claim
→ Server verifies admob_callback_id with Google
→ Server checks rate limits, cooldown, daily cap
→ Server atomically inserts ad_impression + updates org_credits + inserts credit_transaction
→ Server returns { status: "verified" }
```

The mobile hook bypasses ALL of these steps. The `ad_impressions` table is never written to.

### F6 — Production ad unit ID is Google test ID [P0]

**Evidence**: `useRewardedInvoice.ts` lines 24-26:
```typescript
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-3940256099942544/5224354917'; // ← sostituire con ID reale
```

`ca-app-pub-3940256099942544/5224354917` is a Google-provided **test ad unit ID**. Deploying this to production:
- Violates AdMob policy (test ads outside development)
- Generates zero revenue
- May result in account suspension

### F7 — Non-atomic wallet update + ledger insert [P0]

**Evidence**: `useRewardedInvoice.ts` lines 183-206:
```typescript
// Step 1: Update wallet (no transaction)
await supabase.from('org_credits').update({ earned_credits: newEarned, ... })...
// Step 2: Insert ledger entry (separate HTTP request)
await supabase.from('credit_transactions').insert({ ... })...
```

**Failure mode A**: Step 1 succeeds, Step 2 fails (network error, DB constraint) → credit granted with no ledger entry.
**Failure mode B**: Step 1 fails, Step 2 succeeds → ledger shows credit that doesn't exist in wallet.
**Failure mode C**: Step 2 violates UNIQUE constraint on `idempotency_key` → Step 1 already committed, duplicate credit denied but wallet was already updated.

### F8 — Competing migration files [P0]

**Evidence**: Two files with overlapping scope but incompatible schemas:
- `backend/migration_rewarded_ads.sql` → `rewarded_credits` + `reward_claims`
- `backend/migration-rewarded-ads.sql` → `org_credits` + `credit_transactions` + `ad_impressions`
- `backend/migration_rls_policies.sql` → RLS for `rewarded_credits` + `reward_claims` (v1), NOT for `org_credits` + `credit_transactions` (v2)

The hook queries tables from the dash version. The RLS policies cover tables from the underscore version. **Whichever was deployed, the other side breaks.**

### F9 — Modal closes before ad shows [P1]

**Evidence**: `invoices.tsx` lines 63-66:
```typescript
const handleWatchAd = useCallback(() => {
  showAd();          // May fail silently
  setLimitModalVisible(false);  // Closes modal unconditionally
}, [showAd]);
```

If `showAd()` fails (ad expired, not loaded, context lost), the modal is already closed and the user sees nothing. There's no fallback or error display.

### F10 — Error swallowing in `refreshQuota` [P1]

**Evidence**: `useRewardedInvoice.ts` lines 94-96:
```typescript
} catch {
  setQuota((q) => ({ ...q, isLoading: false }));
}
```

All errors (network, auth, permissions, RLS) are caught and silently ignored. The spread `...q` preserves the previous state, which may show `canCreate: true` when the user is actually over quota. No error is surfaced to the UI.

### F11 — `claimCredit` silently returns if no `org_id` [P1]

**Evidence**: `useRewardedInvoice.ts` lines 175-177:
```typescript
if (!orgData?.org_id) return;
```

The user watches the entire ad, the callback fires, but if the org lookup fails or returns null, the function exits with no credit, no error, no user feedback. The ad revenue is lost and the user is confused.

### F12 — Stale closure in `setTimeout(loadAd, 1000)` [P1]

**Evidence**: `useRewardedInvoice.ts` lines 142-146:
```typescript
const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
  setAdLoaded(false);
  setRewarded(null);
  setTimeout(loadAd, 1000);  // ← captures loadAd from THIS closure
});
```

`loadAd` is a `useCallback` with `[refreshQuota]` dependency. If `refreshQuota` reference changes between renders, the CLOSED handler still calls the OLD `loadAd`. Currently benign because `refreshQuota` has `[]` deps (stable), but a time bomb if dependencies change.

### F13 — No cooldown / daily cap enforcement [P1]

**Evidence**: `rewarded_ad_config` defines `min_seconds_between_ads = 300` and `max_ads_per_user_per_day = 5`, but the hook never queries `rewarded_ad_config` and never enforces these limits. Users can watch unlimited ads back-to-back.

### F14 — `rewarded_ad_config.enabled` never checked [P1]

**Evidence**: The config table has `enabled BOOLEAN NOT NULL DEFAULT false`, but no code reads it. Ads work even when the admin has not enabled the feature.

---

## 3.6 Architecture Contract Violations

| ADR-003 Requirement | Hook Implementation | Status |
|---------------------|---------------------|--------|
| Server-side verification via `POST /api/ads/reward-claim` | Client-side direct Supabase call | ❌ VIOLATED |
| Idempotency via `admob_callback_id` | `Date.now() + Math.random()` | ❌ VIOLATED |
| Atomic credit grant + ledger insert | Two separate HTTP requests | ❌ VIOLATED |
| `ad_impressions` table as source of truth | Table never written to | ❌ VIOLATED |
| Rate limiting (10 claims/min) | Not implemented | ❌ VIOLATED |
| Cooldown between ads (300s) | Not enforced | ❌ VIOLATED |
| Daily cap (5 ads/user/day) | Not enforced | ❌ VIOLATED |
| Abuse flagging (`abuse_flags` table) | Not integrated | ❌ VIOLATED |
| Config-driven (`rewarded_ad_config.enabled`) | Never checked | ❌ VIOLATED |

**7 of 9 architectural requirements are violated.** The only ones partially met are the table names (`org_credits`, `credit_transactions`) — but even those have RLS gaps.
