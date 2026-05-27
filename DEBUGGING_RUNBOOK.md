# DEBUGGING RUNBOOK

> **Purpose**: Quick diagnostic guide for on-call engineers and future debuggers.
> **Scope**: All InvoiceStudio mobile subsystems.
> **Last updated**: 2026-05-25

---

## SECTION A: RevenueCat / ProUpgrade Paywall Diagnostics (NEW)

### A-S1: "User taps 'Attiva Abbonamento' and nothing happens"

**Check order**:

1. **Verify RevenueCat is initialized**:
   ```
   # Check logcat (Android) for RevenueCat logs
   adb logcat -s "RevenueCat:*"

   # Expected output:
   # [RevenueCat] Debug: Debug logging enabled
   # [RevenueCat] Debug: SDK Version - ...
   # [RevenueCat] Info: Purchases configured successfully
   ```
   - If no RevenueCat logs → `configureRevenueCat()` was never called. Check root `_layout.tsx`.
   - If `PurchasesNotConfiguredError` → API key is missing or wrong. Check `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.

2. **Check if offerings loaded**:
   ```typescript
   // In React Native Debugger, inspect ProUpgradeScreen state:
   // offerings.length > 0 ?
   ```
   - If `offerings` is empty after mount → `getOfferings()` failed. Check:
     - Network connectivity (RevenueCat API is at `api.revenuecat.com`)
     - Google Play Console: are products created and activated?
     - RevenueCat dashboard: are products/entitlements/offerings configured?

3. **Check if `selectedPackage` is defined**:
   ```typescript
   // In debugger:
   // packages.find(p => p.id === selectedPlanId)?.rcPackage
   ```
   - If `undefined` → Product identifier mismatch between RevenueCat and the code's `id` mapping (e.g., the offering has `pro_monthly` but code expects `monthly`).

4. **Check `purchasingRef.current` guard**:
   - If `handleSubscribe` returns immediately without doing anything, the guard ref may be stuck at `true`. Reset:
     ```typescript
     // In React Native Debugger, manually reset:
     // (add a dev-only reset button during development)
     ```

### A-S2: "Price mismatch between screens"

**Diagnostic**:

1. **Verify RevenueCat product prices**:
   ```bash
   # In RevenueCat Dashboard → Products → check monthly price for each product.
   # Compare with what Google Play Console shows.
   ```

2. **Check local vs RC price**:
   ```typescript
   // In debugger, after getOfferings() completes:
   offerings[0].product.priceString  // e.g., "€4.99"
   offerings[1].product.priceString  // e.g., "€49.99"
   ```
   - These should match Play Console exactly (localized).

3. **Check hardcoded price grep**:
   ```bash
   grep -rn "€\s*\d\+" mobile/app/  # Find any remaining hardcoded prices
   ```

### A-S3: "Purchase completes but entitlement not granted"

**Diagnostic**:

1. **Check RevenueCat CustomerInfo**:
   ```typescript
   // After purchase, inspect:
   const customerInfo = await Purchases.getCustomerInfo();
   console.log(customerInfo.entitlements.active);
   // Should contain: { pro: { ... } }
   ```

2. **Check RevenueCat Dashboard → Customer**:
   - Search by `appUserID` (should be the Supabase user ID if configured correctly).
   - Check "Entitlements" tab → is `pro` active?
   - Check "Transactions" tab → was the purchase processed?

3. **Check Google Play Console**:
   - Under "Order Management" → find the purchase.
   - If purchase exists in Play Console but not RevenueCat → RevenueCat webhook not configured or Google Play Real-time Developer Notifications not set up.

### A-S4: "RevenueCat errors"

| Error | Cause | Fix |
|-------|-------|-----|
| `PurchasesNotConfiguredError` | `Purchases.configure()` not called | Initialize in `_layout.tsx` |
| `UninitializedPropertyError` | Calling RC method before configure | Add guard: `if (!configured) return` |
| `StoreProblemError` | Google Play Billing unavailable | Check Play Store app version, Google account sign-in |
| `NetworkError` | Cannot reach `api.revenuecat.com` | Check internet connectivity, VPN, firewall |
| `PurchaseCancelledError` | User dismissed billing sheet | Normal — handle gracefully, reset loading |
| `ProductNotAvailableForPurchaseError` | Product ID not in Play Console | Verify product is active and matches RC dashboard |
| `ReceiptAlreadyInUseError` | Purchase already processed | Idempotent — treat as success |

### A-S5: "Play Store Billing sheet doesn't open"

**Check**:
1. Device has Google Play Store app (required for billing)
2. User is signed into a Google account on the device
3. App is signed with the same keystore as Play Console upload key
4. Product is "Active" in Google Play Console (not "Inactive" or "Draft")
5. License testing: is the Google account added to "License Testing" in Play Console?
6. Build variant: debug builds may not work with billing unless using `com.android.vending.BILLING` permission + test cards

---

## SECTION B: Rewarded Ads Diagnostics (2026-05-25 — prior analysis)

---

## SYMPTOM → DIAGNOSTIC MAP

### S1: "User watched ad but got no credit"

**Check order**:

1. **Query**: Does `credit_transactions` have an `earn` row for this org in the last 5 minutes?
   ```sql
   SELECT * FROM credit_transactions
   WHERE org_id = '<ORG_ID>' AND entry_type = 'earn'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - **No row** → Go to step 2
   - **Row exists** → Check `org_credits.earned_credits` — if it matches, credit WAS delivered. Problem is in UI refresh (S2).

2. **Query**: Does `ad_impressions` have a row with matching timestamp?
   ```sql
   SELECT * FROM ad_impressions
   WHERE org_id = '<ORG_ID>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - **No row** → The claim never reached the server. Check:
     - `[Network]` tab in mobile debugger — did the `POST /api/ads/reward-claim` request fire?
     - Did it return 4xx/5xx?
   - **Row exists with `verification_status = 'rejected'`** → AdMob verification failed. Check Google AdMob dashboard.
   - **Row exists with `verification_status = 'duplicate'`** → Idempotency gate caught a replay. Investigate if this was a legitimate retry or abuse.
   - **Row exists with `verification_status = 'verified'`** → Go to step 3.

3. **Query**: Is the RLS UPDATE policy on `org_credits` present?
   ```sql
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'org_credits';
   ```
   - Missing `UPDATE` → **RUN**: RLS policy completion migration (see FIX_PR.md WS2 Step 2).

4. **Check atomicity**: Compare SUM of credit_transactions vs org_credits:
   ```sql
   SELECT
     oc.org_id,
     oc.earned_credits AS wallet_earned,
     COALESCE(SUM(ct.amount) FILTER (WHERE ct.entry_type = 'earn'), 0) AS ledger_earned,
     oc.earned_credits - COALESCE(SUM(ct.amount) FILTER (WHERE ct.entry_type = 'earn'), 0) AS drift
   FROM org_credits oc
   LEFT JOIN credit_transactions ct ON ct.org_id = oc.org_id AND ct.entry_type = 'earn'
   GROUP BY oc.org_id, oc.earned_credits
   HAVING oc.earned_credits != COALESCE(SUM(ct.amount) FILTER (WHERE ct.entry_type = 'earn'), 0);
   ```
   - **Non-zero drift** → Wallet and ledger are out of sync. Manual reconciliation needed.

5. **Check for race condition**: Identical `earned_credits` values among rapid claims:
   ```sql
   SELECT org_id, earned_credits, COUNT(*) as claim_count
   FROM credit_transactions
   WHERE entry_type = 'earn'
     AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY org_id, earned_credits
   HAVING COUNT(*) > 1;
   ```
   - **Multiple claims with same `earned_credits`** → Race condition confirmed. Lost credits = claim_count - 1.

---

### S2: "Quota counter shows wrong numbers"

**Check order**:

1. **Verify the query logic**:
   ```sql
   -- Replicate the hook's refreshQuota logic manually:
   SELECT COUNT(*) AS invoices_this_month
   FROM invoices
   WHERE org_id = '<ORG_ID>'
     AND created_at >= date_trunc('month', CURRENT_DATE)
     AND created_at <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
     AND deleted_at IS NULL;

   SELECT earned_credits, consumed_credits
   FROM org_credits
   WHERE org_id = '<ORG_ID>';
   ```
   - If manual query returns different results than the UI → RLS is filtering rows differently for the anon-key client vs admin client.

2. **Check RLS bypass**: Try the query with `supabase.auth.admin` vs anon key:
   - If results differ → RLS is scoping correctly but the client's JWT doesn't contain the expected `org_id` claim.
   - Fix: Verify `current_org_id()` function reads the correct JWT claim.

3. **Check for `deleted_at` null discrepancy**:
   ```sql
   SELECT COUNT(*) FROM invoices WHERE org_id = '<ORG_ID>' AND deleted_at IS NULL;
   SELECT COUNT(*) FROM invoices WHERE org_id = '<ORG_ID>';
   ```
   - If counts differ significantly → Some invoices are soft-deleted and the UI doesn't account for them.

---

### S3: "Ad won't load / shows error"

**Check order**:

1. **Check which ad unit ID is being used**:
   - Inspect `Constants.expoConfig?.extra?.admobRewardedAdUnitId`
   - If `ca-app-pub-3940256099942544/5224354917` (Google test ID) → **Production is using test ads. Fix immediately.**
   - If `TestIds.REWARDED` in non-dev build → same issue.

2. **Check AdMob dashboard**: Is the ad unit approved? Is there a policy violation?

3. **Check `rewarded_ad_config.enabled`**:
   ```sql
   SELECT enabled FROM rewarded_ad_config WHERE id = 1;
   ```
   - If `false` but ads are loading → Feature flag is being ignored.

4. **Check ad load errors in console**:
   - `ERROR_CODE_INTERNAL_ERROR` → AdMob SDK issue, try restarting app
   - `ERROR_CODE_NETWORK_ERROR` → Check device connectivity
   - `ERROR_CODE_NO_FILL` → No ads available for this user/location (common in low-fill regions)
   - `ERROR_CODE_INVALID_REQUEST` → Ad unit ID is wrong or not yet active

---

### S4: "Modal shows 'Non disponibile' even when ad loaded"

**Check order**:

1. **Check `adLoaded` state timing**:
   - The modal receives `adLoaded` as a prop. Is it `true` when the modal is visible?
   - The hook sets `adLoaded = true` in the LOADED event listener. If the ad loaded BEFORE the modal was opened, `adLoaded` should already be `true`.

2. **Check `adLoading` state**:
   - If `adLoading = true`, the spinner shows (correct).
   - If both `adLoaded = false` AND `adLoading = false`, the "Non disponibile" text shows.
   - This means the ad neither loaded nor is loading → `loadAd` might have failed silently.
   - Check `adError` state — errors are displayed below the button.

3. **Check if `showAd()` was called before the modal**:
   - The hook auto-loads on mount. If `showAd()` was called and the ad was consumed, `rewarded` is set to `null` and a reload is scheduled after 1s. During that 1s window, `adLoaded = false` and `adLoading = false`.

---

### S5: "Idempotency key collision suspected"

**Check**:
```sql
SELECT idempotency_key, COUNT(*) as occurrences
FROM credit_transactions
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```
- **Any results** → Collision confirmed. The `UNIQUE` constraint should have prevented this, so check if the constraint exists:
  ```sql
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'credit_transactions'::regclass AND contype = 'u';
  ```
  - If `idempotency_key` is not listed → Missing UNIQUE constraint. **Run migration immediately.**

---

### S6: "Ad plays but no EARNED_REWARD callback fires"

**Diagnostic**:

1. Check if the ad was a test ad — test ads may not always fire the reward callback depending on the test scenario.
2. Check if the user skipped the ad before completion — EARNED_REWARD only fires after full watch.
3. Add temporary logging to `unsubEarned` listener to confirm the event is received.
4. Check if `claimCredit` throws an exception that's swallowed — wrap in try/catch with console.error.

---

## QUICK FIXES (Runbook)

### Fix 1: Credit not delivered — manual grant

```sql
-- For a specific org, manually grant 1 credit with audit trail:
DO $$
DECLARE
  v_org_id uuid := '<ORG_ID>';
  v_idempotency_key text := 'manual_fix_' || gen_random_uuid()::text;
BEGIN
  UPDATE org_credits
  SET earned_credits = earned_credits + 1, updated_at = now()
  WHERE org_id = v_org_id;

  INSERT INTO credit_transactions (org_id, entry_type, amount, idempotency_key, balance_after, reason)
  VALUES (
    v_org_id, 'earn', 1, v_idempotency_key,
    (SELECT earned_credits - consumed_credits FROM org_credits WHERE org_id = v_org_id),
    'Manual fix — forensic bug hunt 2026-05-25'
  );
END $$;
```

### Fix 2: Disable rewarded ads globally
```sql
UPDATE rewarded_ad_config SET enabled = false WHERE id = 1;
```

### Fix 3: Reset an org's credits (reconciliation)
```sql
-- Recalculate earned_credits from ledger
UPDATE org_credits
SET earned_credits = (
  SELECT COALESCE(SUM(amount), 0)
  FROM credit_transactions
  WHERE org_id = org_credits.org_id AND entry_type = 'earn'
)
WHERE org_id = '<ORG_ID>';
```

---

## TOOL REFERENCE

| Tool | Use case |
|------|----------|
| **Supabase SQL Editor** | Run diagnostic queries above |
| **React Native Debugger** | Inspect hook state (`quota`, `adLoaded`, `adError`) |
| **Charles Proxy / Proxyman** | Monitor `POST /api/ads/reward-claim` requests |
| **AdMob Dashboard** | Check ad unit status, fill rate, policy violations |
| **Sentry** | Search for `useRewardedInvoice` errors |
| **`adb logcat`** (Android) | Filter for `Ads` tag: `adb logcat -s Ads:*` |

---

## KNOWN ISSUES (tracked)

| ID | Description | Status |
|----|-------------|--------|
| F1 | RLS missing UPDATE on org_credits | → FIX_PR.md WS2 |
| F2 | RLS missing INSERT on credit_transactions | → FIX_PR.md WS2 |
| F3 | Race condition in credit increment | → FIX_PR.md WS1 |
| F4 | Weak idempotency key | → FIX_PR.md WS1 |
| F5 | No server-side verification | → FIX_PR.md WS1 |
| F6 | Test ad ID in production | → Replace with env var |
