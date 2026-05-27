# INCIDENT TRIAGE

---

## SECTION A: ProUpgrade Paywall v10 (NEW — 2026-05-25)

**Scope**: `mobile/app/(app)/ProUpgrade.tsx`, `mobile/app/(app)/(tabs)/invoices.tsx`, RevenueCat SDK integration
**Severity**: **P0** — Non-functional paywall; app cannot accept real payments
**Owner**: Engineering (mobile)

---

### A.1 Evidence Collected

| Artifact | Status | Notes |
|----------|--------|-------|
| Source files | ✅ | ProUpgrade.tsx (137 lines), invoices.tsx (150 lines), InvoiceLimitModal.tsx (320 lines) |
| Package manifest | ✅ | `react-native-purchases: ^10.1.2` installed but never configured |
| Navigation structure | ✅ | `ProUpgrade` not in explicit `Stack.Screen` list but file-based routing may cover it |
| RevenueCat init | ❌ | `Purchases.configure()` absent from entire codebase |
| Offerings fetch | ❌ | `Purchases.getOfferings()` never called |
| Console/HAR/logs | ❌ | Pre-release code review — runtime data N/A |

### A.2 Initial Hypotheses

| # | Hypothesis | Likelihood |
|---|-----------|------------|
| H1 | `as any` cast on `setSelectedPlan` causes runtime crash | Low — values always "monthly"/"yearly" |
| H2 | Stub `setTimeout` is safe placeholder for production | **FALSE** — non-functional paywall |
| H3 | `handleSubscribe` error handling is adequate | **FALSE** — loading never reset on error |
| H4 | `router.back()` will crash without back stack | Low — always pushed via `router.push()` |
| H5 | Hardcoded prices are acceptable temporarily | **FALSE** — violates Google Play policy |
| H6 | Price mismatch across screens is intentional | **FALSE** — €19 vs €4.99 are contradictory |

### A.3 Reproducibility

| Scenario | Reproducible? |
|----------|---------------|
| Tap "Attiva Abbonamento" → fake alert appears | **Always** |
| See €19 in limit modal then €4.99 on ProUpgrade | **Always** |
| Double-tap "Forse più tardi" during loading | **Always** (no guard) |
| RevenueCat throws error → spinner forever | **Always** (when real code uncommented) |
| `packageToBuy` is undefined → crash | **Always** (when real code uncommented) |

### A.4 Severity Classification — ProUpgrade

| # | Finding | Severity | Rationale |
|---|---------|----------|-----------|
| A-F1 | Non-functional paywall (stub `setTimeout`) | **P0** | Cannot accept real money; user intent to pay is discarded |
| A-F2 | `Purchases.configure()` never called anywhere | **P0** | SDK will throw `PurchasesNotConfiguredError` at runtime |
| A-F3 | Price mismatch: InvoiceLimitModal shows €19/mese, ProUpgrade shows €4.99/€49.99 | **P0** | Misleading pricing; EU consumer law violation risk |
| A-F4 | `packageToBuy` is undefined (commented-out code) | **P0** | Crash when real code is uncommented — `ReferenceError` |
| A-F5 | No `setLoading(false)` in catch block (commented-out code) | **P0** | UI freeze — button disabled forever after any error |
| A-F6 | `handleSubscribe` has no double-tap guard | **P1** | User can trigger purchase twice; RevenueCat may double-charge |
| A-F7 | Cancel button not disabled during loading | **P1** | User can navigate away mid-purchase → abandoned transaction |
| A-F8 | No `clearTimeout` on unmount | **P1** | `setState` on unmounted component warning; potential leak |
| A-F9 | `selectedPlan` never read in `handleSubscribe` | **P2** | User plan selection silently ignored |
| A-F10 | `as any` cast on `setSelectedPlan(pkg.id as any)` | **P2** | Code quality — defeats type safety, won't crash |
| A-F11 | Hardcoded prices violate Google Play Billing policy | **P0** | Must fetch prices from RevenueCat `getOfferings()` |
| A-F12 | `packages` array recreated every render | **P3** | Minor perf — missing `useMemo` |

---

## SECTION B: Rewarded Ads Bug Hunt (2026-05-25 — prior analysis)

**Date**: 2026-05-25
**Scope**: `useRewardedInvoice.ts`, `InvoiceLimitModal.tsx`, `invoices.tsx`, `migration-rewarded-ads.sql`, `migration_rewarded_ads.sql`, `migration_rls_policies.sql`
**Severity**: **P0** — Multiple critical findings that block the feature from functioning correctly

---

## 1.1 Severity Classification

| # | Finding | Severity | Rationale |
|---|---------|----------|-----------|
| F1 | RLS: Missing UPDATE policy on `org_credits` | **P0** | Credits can never be earned — UPDATE blocked by RLS |
| F2 | RLS: Missing INSERT policy on `credit_transactions` | **P0** | Ledger can never be written — audit trail broken |
| F3 | Race condition: non-atomic `earned_credits` increment | **P0** | Concurrent ad rewards cause lost credits (last-write-wins) |
| F4 | Idempotency key uses `Date.now() + Math.random()` instead of AdMob callback ID | **P0** | Replay attacks possible; architecture contract violated |
| F5 | No server-side AdMob verification — client trusted | **P0** | Trivial to forge ad watches; zero fraud protection |
| F6 | Production ad unit ID is Google test ID | **P0** | Policy violation + zero revenue |
| F7 | `org_credits` UPDATE and `credit_transactions` INSERT not atomic | **P0** | Can lose credit or ledger entry on partial failure |
| F8 | Competing migration files — schema mismatch | **P0** | `rewarded_credits` vs `org_credits` — which schema is deployed? |
| F9 | `handleWatchAd` closes modal before ad shows — silent failure path | **P1** | UX dead-end; user clicks, modal closes, nothing happens |
| F10 | Error swallowing in `refreshQuota` | **P1** | Stale/corrupt quota shown to user with no feedback |
| F11 | `claimCredit` silently returns if no `org_id` | **P1** | Ad consumed, credit lost, user unaware |
| F12 | `setTimeout(loadAd, 1000)` stale closure risk | **P1** | Ad reload chain can break after re-render |
| F13 | No cooldown/daily cap enforcement | **P1** | Users can watch unlimited ads; fraud vector |
| F14 | `rewarded_ad_config.enabled` never checked | **P1** | Feature flag ignored; ads work even when disabled |
| F15 | Stale closure: `claimCredit` not in `loadAd` deps | **P2** | Works today (stable identity) but violates rules of hooks |
| F16 | `RewardedAd` objects never explicitly destroyed | **P2** | Potential memory leak on repeated ad loads |
| F17 | `showAd` doesn't check ad expiry | **P2** | Stale ad object may fail silently |
| F18 | Invoice count query missing explicit `org_id` filter | **P2** | Relies solely on RLS; catastrophic if misconfigured |
| F19 | `maybeSingle()` error not distinguished from null | **P2** | DB errors silently treated as "no data" |
| F20 | `Math.random()` used for security-sensitive idempotency | **P3** | Non-cryptographic PRNG |
| F21 | No TypeScript types for Supabase responses | **P3** | Easy to typo column names |

---

## 1.2 Symptom Capture

### Observed behavior (hypothetical — based on code analysis):
- User watches rewarded ad → EARNED_REWARD event fires → `claimCredit()` called
- `claimCredit()` does UPDATE on `org_credits` → **RLS blocks it** (no UPDATE policy)
- `claimCredit()` does INSERT on `credit_transactions` → **RLS blocks it** (no INSERT policy)
- **Net result**: Ad watched, no credit granted, no error shown to user
- OR if RLS somehow doesn't block: race condition causes credit loss on rapid watches

### Environment:
- React Native (Expo) mobile app
- `react-native-google-mobile-ads` library
- Supabase PostgreSQL backend
- Anon-key client (not admin/service_role)

---

## 1.3 Reproducibility Assessment

| Finding | Reproducibility |
|---------|-----------------|
| F1-F2 (RLS gaps) | **Always** — deterministic; RLS policies are missing |
| F3 (race condition) | **Sometimes** — requires two EARNED_REWARD events within same JS tick |
| F4 (idempotency) | **Always** — design flaw present in every call |
| F5 (no verification) | **Always** — there is no server verification step |
| F6 (test ad ID) | **Always** — hardcoded in production branch |
| F7 (non-atomic) | **Sometimes** — on partial failure |
| F8 (schema mismatch) | **Always** — compile-time problem |
| F9 (modal closes early) | **Often** — whenever ad fails to show after modal close |

---

## 1.4 Isolation

The bugs are distributed across three layers:

| Layer | Findings |
|-------|----------|
| **Database schema + RLS** | F1, F2, F7, F8 — missing policies, competing migrations, non-atomicity |
| **Mobile hook (`useRewardedInvoice.ts`)** | F3, F4, F5, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21 |
| **UI layer (`InvoiceLimitModal.tsx` / `invoices.tsx`)** | F6 (partial — config in hook), F9, F10 |

**Root cause distribution**: ~60% in the hook, ~25% in the DB schema, ~15% in UI integration.

---

## 1.5 Initial Hypotheses

1. **Primary**: The hook was built against the `migration-rewarded-ads.sql` (dash) schema but the RLS policies file (`migration_rls_policies.sql`) was built against the older `migration_rewarded_ads.sql` (underscore) schema. The two were never reconciled, leaving critical RLS gaps.

2. **Secondary**: The architecture document (ADR-003) specifies server-side verification via a `POST /api/ads/reward-claim` endpoint, but the mobile hook bypasses this entirely and calls Supabase directly. This is either a deliberate MVP shortcut that was never revisited, or a misinterpretation of the architecture.

3. **Tertiary**: The hook was written for a single-user, synchronous mental model and never tested under concurrent load, rapid-fire events, or network failure conditions.

---

## Assigned Owner

TBD — requires backend (RLS policies + idempotency) and mobile (hook rewrite) coordination.
