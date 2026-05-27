# POST-MORTEM

---

## SECTION A: ProUpgrade Paywall v10 (NEW — 2026-05-25)

**Incident Type**: Proactive bug hunt (pre-production) — no users impacted yet
**Severity**: P0 (non-functional paywall would ship to production)
**Author**: Forensic debugger (Principal Engineer)

### A.1 Incident Timeline

| Time | Event |
|------|-------|
| ~2026-05-20-24 | `ProUpgrade.tsx` built as UI prototype with stub paywall |
| ~2026-05-20-24 | `InvoiceLimitModal.tsx` wired with "€19/mese" hardcoded price |
| ~2026-05-24 | `react-native-purchases: ^10.1.2` added to `package.json` |
| 2026-05-25 | Forensic bug hunt discovers 13 findings — 7 P0, 3 P1 |
| **2026-05-25** | **This post-mortem filed — ProUpgrade blocked from release** |

### A.2 Detection Time

- **Time from bug introduction to discovery**: ~1-5 days
- **Detection method**: Manual forensic code review
- **Would automated tests have caught this?** Yes — a single integration test calling `handleSubscribe` would have revealed: (a) no RevenueCat init, (b) `packageToBuy` undefined, (c) loading never reset on error.

### A.3 What Happened?

The ProUpgrade paywall was built as a UI prototype — beautiful design, but with a fake purchase flow. Three fundamental gaps made it non-functional:

1. **RevenueCat was never initialized** — SDK installed but `Purchases.configure()` never called anywhere in the codebase.
2. **Prices were hardcoded independently in two screens** — `InvoiceLimitModal` says €19/mese, `ProUpgrade` says €4.99/mese.
3. **The purchase code was written as pseudocode** — commented-out, referencing undefined variables, with missing error handling.

### A.4 Why Did It Happen?

1. **"Visual done" confused with "feature done"**: The screen looked complete (prices, plans, CTA, animations) but the business logic was entirely fake. There was no definition of done that required a functional purchase test.

2. **RevenueCat treated as "later" without a gate**: The stub `setTimeout` with "In arrivo!" message suggests the developer knew it was incomplete but expected it to be finished before release. There was no CI block, TODO expiration, or feature flag preventing the screen from being accessible.

3. **No shared price source**: Two screens independently hardcoded prices because there was no single source of truth (RevenueCat `getOfferings()` or even a constants file). This is a systemic issue — any new paywall screen would repeat the problem.

4. **TypeScript couldn't help**: The import being commented out removed all type checking. The `as any` cast on `setSelectedPlan` was a workaround for a problem that should have been solved at the type level.

### A.5 Systemic Analysis

This is the **second architecture-contract violation** discovered in this bug hunt (the first being the Rewarded Ads hook bypassing the server endpoint). Pattern:

| Architecture Contract | Implementation | Status |
|-----------------------|----------------|--------|
| RevenueCat as pricing source of truth | Hardcoded prices in 2+ files | ❌ VIOLATED |
| Use `Purchases.purchasePackage()` for subscriptions | `setTimeout(() => Alert.alert(...))` | ❌ VIOLATED |
| `POST /api/ads/reward-claim` for credit delivery | Direct Supabase client call | ❌ VIOLATED (prior hunt) |

**Root cause pattern**: The mobile codebase has a tendency to build UI-first and defer backend integration, but the deferred integration has no enforcement mechanism (CI gate, TODO expiry, feature flag) — so the stub code becomes the production code.

### A.6 Prevention Measures

| Measure | Tool | Priority |
|---------|------|----------|
| **CI gate: no `setTimeout` stubs in purchase handlers** | ESLint custom rule `no-fake-purchase` | P0 |
| **Pre-commit hook: `Purchases.configure` must exist** | Bash script in `.husky/pre-commit` | P0 |
| **Type-safe offerings mapping** | Use RevenueCat TypeScript types throughout | P1 |
| **Shared `useProPrice()` hook** | All screens read from one source | P1 |
| **Integration test: E2E purchase flow** | Detox/Maestro test before merge | P1 |
| **TODO expiry bot** | Scan for `TODO(revenuecat)` and create issues with deadlines | P2 |

### A.7 Action Items

| # | Action | Owner | Deadline | Priority |
|---|--------|-------|----------|----------|
| 1 | Create `mobile/lib/revenueCat.ts` with `configureRevenueCat()` | Mobile | 2026-05-27 | P0 |
| 2 | Initialize RevenueCat in root `_layout.tsx` | Mobile | 2026-05-27 | P0 |
| 3 | Rewrite `ProUpgrade.tsx` with real `getOfferings()` + `purchasePackage()` | Mobile | 2026-05-28 | P0 |
| 4 | Add `useProPrice()` hook + wire in `InvoiceLimitModal.tsx` | Mobile | 2026-05-28 | P0 |
| 5 | Add `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to CI env | DevOps | 2026-05-27 | P0 |
| 6 | Add ESLint rule `no-fake-purchase` | DevEx | 2026-06-01 | P1 |
| 7 | Add E2E purchase test (Detox) | QA | 2026-05-30 | P1 |
| 8 | Add `DEBUGGING_RUNBOOK.md` entries for RevenueCat | DevEx | 2026-05-30 | P2 |

---

## SECTION B: Rewarded Ads Post-Mortem (2026-05-25 — prior analysis)

---

## Incident Timeline

| Time | Event |
|------|-------|
| 2026-05-19 | Two competing migration files committed (`migration_rewarded_ads.sql` v1 and `migration-rewarded-ads.sql` v2/ADR-003) |
| 2026-05-19 | RLS policies file committed — scoped to v1 tables only |
| ~2026-05-19-20 | `useRewardedInvoice.ts` written against ADR-003 schema |
| ~2026-05-19-20 | `InvoiceLimitModal.tsx` and `invoices.tsx` integration completed |
| 2026-05-25 | Forensic bug hunt discovers 21 findings — 8 P0, 6 P1 |
| **2026-05-25** | **This post-mortem filed — feature should be blocked from release until fixes applied** |

## Detection Time

- **Time from bug introduction to discovery**: ~6 days (2026-05-19 to 2026-05-25)
- **Detection method**: Manual forensic code review (not automated tests)
- **Would automated tests have caught this?** Yes — a single E2E test with the anon-key Supabase client and RLS enabled would have caught F1, F2, F3, and F7.

## Resolution Time

- **Estimated fix effort**: 7-10 hours (see FIX_PR.md workstreams)
- **Critical path**: Server endpoint implementation (WS1) — 4-6h
- **Blocker**: Need to verify whether `react-native-google-mobile-ads` exposes AdMob SSV callback data

---

## Blameless Analysis

### What happened?

The Rewarded Ads feature was implemented across three layers (database, mobile hook, UI) by different contributors without an integration test that exercised the full stack. Two schema designs evolved in parallel and were never reconciled. The mobile hook took a shortcut — calling Supabase directly instead of routing through the server verification endpoint specified in the architecture document — introducing race conditions, missing RLS policies, and circumventing all fraud protection.

### Why did it happen?

1. **No integration/E2E test**: The most critical gap. A single test that calls the mobile hook against a live Supabase instance with RLS enabled would have caught 4 P0s immediately (F1, F2, F3, F7).

2. **Architecture document not enforced**: ADR-003 clearly specifies `POST /api/ads/reward-claim` as the sole entry point for credit claims. The mobile hook implemented a completely different path. There was no lint rule, code review checklist, or CI check that validated architectural compliance.

3. **Competing migration files**: Two files covering the same domain (`migration_rewarded_ads.sql` and `migration-rewarded-ads.sql`) were committed within the same day. The naming convention (underscore vs dash) made them easy to confuse. No `DROP TABLE IF EXISTS` or explicit deprecation comment marked one as obsolete.

4. **RLS policies in a separate file**: `migration_rls_policies.sql` was written for v1 tables and never updated. RLS policies should be co-located with the table definitions they protect, or generated via a tool.

5. **MVP shortcut never revisited**: The direct-to-Supabase approach may have been a deliberate MVP shortcut ("we'll add server verification later"). If so, there was no tracking issue or `TODO` comment marking it as tech debt.

### What went well?

- The architecture document (ADR-003) is thorough and correctly identifies the requirements — it just wasn't followed.
- The hook structure (`useRewardedInvoice`) is well-factored with clear separation of concerns — the issues are in implementation details, not architecture.
- The UI components (`InvoiceLimitModal`, `invoices.tsx`) are clean and the animation system is solid.
- The bug was caught before production deployment.

---

## Systemic Analysis

### Is this a unique bug or part of a broader class?

This is a **recurring pattern** in this codebase (based on prior audits):

| Prior Finding | This Bug | Pattern |
|---------------|----------|---------|
| Fullstack audit 2026-05-18: "No integration tests" | No E2E test for rewarded ads flow | **Missing integration tests across all features** |
| Fullstack audit: "RLS policies incomplete" | Missing UPDATE/INSERT policies for new tables | **RLS policies not systematically verified** |
| Fullstack audit: "Direct DB access from client" | Hook calls Supabase directly vs server endpoint | **Architecture bypass pattern** |

### Codebase audit for similar patterns

The following grep patterns can find similar issues:

```bash
# Direct Supabase mutations from mobile client (should use server endpoints)
grep -rn "supabase.from.*\.(update|insert|upsert|delete)" mobile/

# RLS policy completeness check (compare table definitions with policies)
# Manual: for each table, verify SELECT/INSERT/UPDATE/DELETE policies exist

# Race conditions: read-then-write patterns without atomicity
grep -rn "select.*\.eq.*\.maybeSingle\|\.single" mobile/ | grep -A5 "update\|insert"

# idempotency key generation using non-cryptographic methods
grep -rn "Math.random\|Date.now" mobile/lib/ | grep -i "idempot\|key\|uuid"
```

---

## Prevention Measures

### 1. New lint rules

| Rule | Tool | Description |
|------|------|-------------|
| `no-direct-supabase-mutation` | ESLint (custom) | Flag `supabase.from().update/insert/delete` in mobile/ directory — require server endpoint |
| `no-math-random-idempotency` | ESLint (custom) | Flag `Math.random()` near `idempotency_key` or `idempotencyKey` |
| `require-try-catch-log` | ESLint | Empty catch blocks must have at least `console.error` |

### 2. New tests (blocking PR merge)

- **E2E**: Rewarded ad full flow (load → show → earn → verify DB state)
- **Integration**: `claimCredit` with mocked Supabase — verify RLS policies pass
- **Concurrency test**: 10 parallel `claimCredit` calls — verify credits = 10, not 1
- **Idempotency test**: Duplicate `admob_callback_id` — verify 200 with `status: "duplicate"`

### 3. CI/CD gates

- **Pre-merge**: Run E2E test on Supabase staging with RLS enabled
- **Pre-deploy**: Verify `current_org_id()` function exists and returns valid UUID
- **Schema drift check**: Compare all `CREATE TABLE` statements with their RLS policies — flag tables with <4 policies

### 4. Additional monitors / alerts

| Alert | Condition | Channel |
|-------|-----------|---------|
| `credit_tx_without_impression` | `credit_transactions.entry_type = 'earn'` with no matching `ad_impression` row | Sentry |
| `duplicate_claim_attempt` | `ad_impressions` INSERT fails with `23505` (unique violation) > 10/hour | Sentry |
| `credit_balance_drift` | `org_credits.earned_credits != SUM(credit_transactions.amount WHERE entry_type='earn')` for any org | Daily cron → Slack |
| `ads_disabled_but_earning` | `rewarded_ad_config.enabled = false` AND new `credit_transactions.entry_type = 'earn'` | PagerDuty P2 |

### 5. Documentation updates

- [ ] Update `InvoiceStudio_Documentazione.md` — add "Rewarded Ads Architecture" section referencing ADR-003
- [ ] Add `DEBUGGING_RUNBOOK.md` for rewarded ads (see below)
- [ ] Mark `migration_rewarded_ads.sql` (underscore) as DEPRECATED in file header
- [ ] Add `CODEOWNERS` entry for `migration-*.sql` files → backend lead

---

## Action Items

| # | Action | Owner | Deadline | Priority |
|---|--------|-------|----------|----------|
| 1 | Implement `POST /api/ads/reward-claim` server endpoint (if not complete) | Backend | 2026-05-27 | P0 |
| 2 | Add missing RLS policies (`org_credits` UPDATE, `credit_transactions` INSERT) | Backend | 2026-05-27 | P0 |
| 3 | Rewrite `claimCredit()` to call server endpoint | Mobile | 2026-05-28 | P0 |
| 4 | Replace production ad unit ID with env var | Mobile | 2026-05-28 | P0 |
| 5 | Fix modal-close-before-ad-shows (F9) | Mobile | 2026-05-28 | P1 |
| 6 | Add error surfacing to `refreshQuota` catch block | Mobile | 2026-05-28 | P1 |
| 7 | Implement cooldown + daily cap enforcement (server-side) | Backend | 2026-05-29 | P1 |
| 8 | Deprecate `migration_rewarded_ads.sql` (v1) | Backend | 2026-05-27 | P2 |
| 9 | Add E2E test for rewarded ad flow | QA | 2026-05-30 | P1 |
| 10 | Add concurrency test for credit claims | QA | 2026-05-30 | P1 |
| 11 | Add ESLint custom rules | DevEx | 2026-06-01 | P2 |
| 12 | Create `DEBUGGING_RUNBOOK.md` for rewarded ads | DevEx | 2026-05-30 | P2 |

---

## Lessons Learned

1. **Architecture documents are not self-enforcing.** ADR-003 was thorough but the implementation diverged. We need either automated architecture validation (lint rules, CI checks) or mandatory architecture review as part of code review.

2. **Naming matters.** `migration_rewarded_ads.sql` vs `migration-rewarded-ads.sql` — one underscore vs dash difference — led to two competing schemas. File naming conventions for migrations should be enforced (e.g., `YYYYMMDD_HHMM_description.sql`).

3. **RLS policies should be tested, not assumed.** PostgreSQL RLS silently rejects operations with no error on the `supabase-js` client side (just `{ data: null, error: null }`). This makes RLS policy gaps invisible unless explicitly tested.

4. **"MVP shortcuts" need expiration dates.** If the direct-Supabase approach was intentional for speed, it should have had a tracking issue with a deadline for implementing the server endpoint. Without that, shortcuts become permanent.
