# 🔍 Forensic Debugging Audit — VELA Invoice Studio Mobile
**Date:** 2026-07-31  
**Branch:** `fix/16kb-page-size-patchelf` (3b7174e)  
**Version:** code 65 / name 1.0.65  
**Auditor:** Forensic Debugger Agent  
**Methodology:** Hypothesis-driven, evidence-based — no assumptions, file:line traces only.

---

## EXECUTIVE SUMMARY

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | TabLayout undefined-function crash | P0 | 🟡 PARTIALLY RESOLVED |
| 2 | PlanContext RC useEffect re-subscription cycle | P2 | 🟡 PARTIALLY RESOLVED |
| 3 | cloud-sync.ts setInterval leak (dormant dead code) | P2 | ⚪ DORMANT DEAD CODE |
| 4 | Scanner 401 → login redirect | P0 | 🟢 RESOLVED |
| 5 | ProUpgrade missing isMounted guard | P2 | 🟡 PARTIALLY RESOLVED |
| 6 | BannerAd premium gating | P1 | 🟢 RESOLVED |
| 7 | No crash reporting (Sentry/Crashlytics) | P2 | 🔴 OPEN |
| 8 | Three-plan-system data sync gap | P2 | 🔴 OPEN |
| 9 | Version jump v40→v65 | N/A | ⚪ NOT A BUG |

---

## DETAILED FINDINGS

---

### BUG 1: TabLayout `undefined is not a function` — Navigator Middleware Race

**FILE:** `mobile/app/(app)/_layout.tsx` lines 31-36  
**FILE:** `mobile/app/_layout.tsx` lines 140-143 (`LocaleSlot`)  
**FILE:** `mobile/app/(app)/(tabs)/_layout.tsx` lines 1-66

```
BUG: TabLayout:849901 undefined is not a function
EVIDENZA: expo-router v4 navigator middleware race — documented in project memory
STATO: 🟡 PARZIALMENTE RISOLTO
```

**Primary fix — IN PLACE:** `mobile/app/(app)/_layout.tsx:31-36`
```tsx
{/* IMPORTANT: only register OUT-OF-tabs screens here. Tab routes
    (invoices, clients, settings) live inside (tabs)/_layout.tsx and
    MUST NOT be redeclared here — doing so creates a colliding
    descriptor map during cold boot whose .options is undefined,
    producing "undefined is not a function at TabLayout". */}
```
Only out-of-tab screens are registered (`scanner`, `[invoice]`, `clients/[id]`, etc.). Tab routes are NOT redeclared. ✅

**Secondary fix — IN PLACE:** `mobile/app/_layout.tsx:140-143`
```tsx
function LocaleSlot() {
  const { locale } = useLocale();
  return <Slot key={locale} />;
}
```
The outer `<Slot key={locale} />` forces remount of the entire navigator tree on locale change, ensuring `TabLayout` and all its children re-render with the new locale dictionary. ✅

**Remaining risk:** The `(tabs)/_layout.tsx` uses `<Tabs>` directly without a key prop. If a partial locale change arrives that doesn't trigger the root `LocaleSlot` remount but still causes re-render of `TabLayout`, the `useLocale().t()` could return stale function references. However, since the `t()` function is returned from `useLocale()`, and tab screen `options.title` re-evaluates on every render (they're inline functions), this is LOW RISK.

**Verdict:** The documented fix is in place and correct. The `Slot key={locale}` approach at root level is the idiomatic solution.

---

### BUG 2: PlanContext RevenueCat useEffect Re-subscription Cycle

**FILE:** `mobile/context/PlanContext.tsx` lines 203-273

```
BUG: PlanContext double-refresh — RC listener re-subscribes on every isPremium change
EVIDENZA: useEffect dependency on [isPremium] at line 273
STATO: 🟡 PARZIALMENTE RISOLTO
```

**The chain:**
1. Mount → `useEffect([isPremium])` runs → `waitForPurchasesConfigured()` → `getCustomerInfo()` reports `entitlements.active['pro'] === true`
2. `handlePremiumActivation()` calls `refreshLimits()` → `limits.plan = 'premium'` → `isPremium` becomes `true`
3. `isPremium` changed → **effect re-runs entirely:**
   - Old listener is cleaned up (`cancelled = true`, `unsubscribe()`, `removeCustomerInfoUpdateListener()`)
   - New `waitForPurchasesConfigured()` starts
   - New `getCustomerInfo()` is called AGAIN
   - New listener is added

**This is wasteful but not harmful** because:
- The `cancelled` ref guard prevents stale callbacks from updating state
- The `handlePremiumActivation` is gated by `hasPro && !isPremium` (line 223), so the second call would skip activation (isPremium is already true)
- The duplicate `getCustomerInfo()` call just fires and is ignored

**Dead code vestige:** `pollTimer` at line 241 is declared as `let pollTimer: ReturnType<typeof setInterval> | undefined;` but is NEVER assigned. Only cleaned up at line 266: `if (pollTimer) clearInterval(pollTimer);`. This is a leftover from a previous polling-based approach that was replaced with recursive `setTimeout` in `waitForPurchasesConfigured`. Harmless but noisy.

**Fix severity:** Low. The `[isPremium]` dependency should be changed to `[]` (empty) since the listener should be stable for the component lifetime. The `customerInfoListener` closure already captures the callback and the `!isPremium` guard inside it handles the premium detection correctly regardless of the outer dependency.

---

### BUG 3: cloud-sync.ts setInterval Leak — Dormant Dead Code

**FILE:** `mobile/lib/cloud-sync.ts` line 32

```
BUG: setInterval never cleared — permanent memory/CPU leak if initializeCloudSync() is ever called
EVIDENZA: setInterval(() => { syncPendingChanges(); }, SYNC_INTERVAL) with no cleanup return
STATO: ⚪ DORMANTE (CODICE MORTO)
```

```ts
export async function initializeCloudSync(): Promise<void> {
  // Start periodic sync
  setInterval(() => {   // ← NEVER CLEARED. No clearInterval anywhere.
    syncPendingChanges();
  }, SYNC_INTERVAL);
  // ...
}
```

**Mitigating factor:** `initializeCloudSync` is NEVER imported or called anywhere in the mobile codebase. Grep for `import.*initializeCloudSync` and `import.*cloud-sync` both return zero matches. This is dead code.

**If ever activated:** Each call would create a permanent `setInterval` firing every 5 minutes. Multiple calls would create multiple concurrent intervals. On React Native, intervals survive component unmounts unless explicitly cleared. The leak would accumulate over app restarts (though process kill resets it).

**Recommended fix:** Either (a) return a cleanup function from `initializeCloudSync`, or (b) use a single `setInterval` reference + guard against multiple init calls, or (c) archive the file if cloud sync is not going to be used.

---

### BUG 4: Scanner 401 Session Recovery

**FILE:** `mobile/app/(app)/scanner.tsx` lines 189-192  
**FILE:** `mobile/lib/ai.ts` lines 55-61

```
BUG: Scanner 401 session recovery — expired auth in R8/ProGuard release builds
EVIDENZA: 401 check at scanner.tsx:189 + apiFetch returns 401 on no session
STATO: 🟢 RISOLTO
```

**Scanner 401 check — PRESENT:**
```tsx
// scanner.tsx:189-192
if (status === 401) {
  router.replace("/(auth)/login" as any);
  return;
}
```

**apiFetch 401 propagation — PRESENT:**
```ts
// ai.ts:55-61
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  return { data: null, error: "Non autenticato", status: 401 };
}
```

The flow is correct:
1. `apiFetch` returns `{ status: 401 }` when session is null
2. Scanner's `handleAnalyze` checks `if (status === 401)` and redirects to login
3. The redirect happens BEFORE any error message or state update that would confuse the user

**No false positives:** The `apiFetch` function distinguishes between session absence (status 401) and network errors (status 0), so a temporary network failure won't trigger login redirect.

---

### BUG 5: ProUpgrade Missing isMounted Guard

**FILE:** `mobile/app/(app)/ProUpgrade.tsx` lines 125-169

```
BUG: No isMounted guard for async state updates during purchase flow
EVIDENZA: setPurchaseState() calls after async Purchases operations — component could be unmounted
STATO: 🟡 PARZIALMENTE RISOLTO
```

**What works:**
- Timeout handling (15s timeout, cleared on success/error/cancel) ✅
- `entitlements.active['pro']` check correct ✅
- `navTimer` cleanup in useEffect return ✅
- `timeoutRef` cleanup on unmount ✅
- Error states display properly with retry button ✅
- Restore purchases flow with error handling ✅

**What's missing:**
```tsx
const handleSubscribe = async () => {
  setPurchaseState("loading");  // Safe — synchronous
  // ...
  const { customerInfo } = await Purchases.purchasePackage(pkg);  // ← ASYNC — user could navigate away
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  if (customerInfo.entitlements.active['pro']) {
    setPurchaseState("success");  // ← Could fire on unmounted component
  } else {
    setPurchaseState("error");    // ← Could fire on unmounted component
    setErrorMessage(t("modal.pro_upgrade.error.subscription_not_detected"));
  }
  // ...
};
```

In React 18+/19 Strict Mode, this would produce a console warning ("Can't perform a React state update on an unmounted component"). While not a crash, it indicates a missing cleanup. In production (non-StrictMode), the warning is suppressed but the state update still executes on an unmounted component — typically harmless but technically incorrect.

**Fix:** Add an `isMounted` ref (like `scanner.tsx` already does) and guard all post-await `setPurchaseState` calls.

---

### BUG 6: BannerAd Premium Gating

**FILE:** `mobile/app/(app)/(tabs)/index.tsx` line 583  
**FILE:** `mobile/app/(app)/(tabs)/settings.tsx` line 257  
**FILE:** `mobile/app/(app)/(tabs)/clients.tsx` line 271  
**FILE:** `mobile/components/BannerAdWrapper.tsx` lines 31-44

```
BUG: Ads shown to premium users
EVIDENZA: All three tab screens gate BannerAd with !isPremium
STATO: 🟢 RISOLTO
```

**Premium gating — VERIFIED on all three screens:**
- Dashboard (`index.tsx:583`): `{!isPremium && (<BannerAdWrapper ... />)}` ✅
- Settings (`settings.tsx:257`): `{!isPremium && (<BannerAdWrapper ... />)}` ✅
- Clients (`clients.tsx:271`): `!isPremium ? <BannerAdWrapper ... /> : null` ✅
- Invoices: EXPLICITLY excludes BannerAdWrapper (comment at line 401: "BannerAdWrapper non è nella lista allowed") ✅

**BannerAdWrapper graceful failure:**
```tsx
// BannerAdWrapper.tsx:31-44
const [failed, setFailed] = useState(false);
if (failed) return null;  // ← Hides silently on ad load failure
// ...
<BannerAd onAdFailedToLoad={() => setFailed(true)} />
```
No crash, no layout shift on ad failure. ✅

**AdMob interstitial (`ads.ts`):** Proper timeout (8s), throttling (60s between ads), idempotent init, and `maybeShowInterstitial` returns false gracefully on any failure. ✅

---

### BUG 7: No Crash Reporting Service — Sentry/Crashlytics Absent

**FILE:** `mobile/app/_layout.tsx` lines 18-28 (global error handler)  
**FILE:** `mobile/app/components/StartupErrorBoundary.tsx` (error boundary)

```
BUG: No crash reporting service configured — crashes go unreported
EVIDENZA: grep for "sentry|Sentry|@sentry" returns 0 matches
STATO: 🔴 APERTO
```

**What exists:**
1. `StartupErrorBoundary.tsx` — class component catching render errors in the provider tree. Displays a user-facing error screen with stack trace. Logs to `console.error`. Does NOT report anywhere.
2. `ErrorUtils.setGlobalHandler` in `_layout.tsx:18-28` — catches JS errors that escape React boundaries. Only calls `console.error`. No reporting.

**What's missing:**
- No Sentry, Firebase Crashlytics, Bugsnag, or any crash reporting SDK
- No `global.addEventListener('unhandledrejection', ...)` for unhandled Promise rejections
- No telemetry on startup failures (the `[BOOT]` diagnostic logs exist but are only visible in dev mode via `logBoot`)
- Crash data is LOST when the user dismisses the error screen or kills the app

**Impact:** All production crashes (TabLayout, R8/ProGuard, camera, RevenueCat) go unreported. The team relies on user reports and manual testing. This is the single highest-impact gap in the current debugging infrastructure.

**Recommendation:** Add `@sentry/react-native` with the standard `Sentry.init()` in the root layout. Even the free tier would capture all unhandled errors + breadcrumbs.

---

### BUG 8: Three-Plan-System Data Sync Gap

**FILE:** `mobile/context/PlanContext.tsx` lines 87-120 (`writePremiumToSupabase` → writes to `user_plan.plan`)  
**FILE:** `mobile/lib/smart-notifications.ts` lines 163-180 (`isPremium` reads from `user_engagement.is_premium`)  
**FILE:** `mobile/context/EngagementContext.tsx` (has its own `engagement.isPremium`)

```
BUG: Three independent premium flags — no synchronization guarantee
EVIDENZA:
  - PlanContext writes to: user_plan.plan = 'premium'
  - smart-notifications reads from: user_engagement.is_premium
  - EngagementContext has its own: engagement.isPremium (from user_engagement table)
STATO: 🔴 APERTO
```

**The three systems:**

| System | Table.Column | Written by | Read by |
|--------|-------------|------------|---------|
| PlanContext | `user_plan.plan` | `writePremiumToSupabase()` | `usePlanLimits()` via `fetchPlanLimits()` |
| EngagementContext | `user_engagement.is_premium` | `engagement-engine.ts` (unknown trigger) | `useEngagement()` |
| Smart Notifications | `user_engagement.is_premium` | (none — read only) | `smart-notifications.ts` `isPremium()` |

**The sync gap:** When a user purchases Pro via RevenueCat:
1. PlanContext detects it → writes `user_plan.plan = 'premium'` ✅
2. PlanContext's `refreshLimits()` refreshes → `isPremium` becomes `true` ✅
3. BUT: `user_engagement.is_premium` is NEVER updated by the purchase flow
4. EngagementContext still reads `is_premium: false` from `user_engagement`
5. Smart notifications may check `user_engagement.is_premium` and get stale `false`

**Actual impact:**
- **LOW for immediate UX:** The PlanContext's `isPremium` gates BannerAd visibility, feature limits, and paywall display. This works correctly.
- **MEDIUM for smart notifications:** If notifications check `user_engagement.is_premium`, premium users might still receive free-tier reminder notifications.
- **MEDIUM for analytics/reporting:** Dashboard metrics that rely on `user_engagement.is_premium` for segmentation will be wrong.

**Root cause:** The purchase flow in `PlanContext.handlePremiumActivation()` only updates `user_plan`, not `user_engagement`. There's no cross-table synchronization.

**Fix:** Add `supabase.from('user_engagement').update({ is_premium: true }).eq('org_id', orgId)` inside `writePremiumToSupabase()` after the `user_plan` update succeeds.

---

### BUG 9: Version Jump v40 → v65 — Not a Defect

```
BUG: Version jumped from v40 to v65 — skipped feature releases?
EVIDENZA: git log shows all intermediate versions are build/pipeline iterations
STATO: ⚪ NON RIPRODUCIBILE (non è un bug)
```

**Version history analysis (v40→v65):**

| Range | # Bumps | Purpose |
|-------|---------|---------|
| v41-43 | 3 | 16KB page alignment, ProGuard/R8 keep rules, Gradle fixes |
| v44-47 | 4 | AdMob re-introduction, package name reversions, signing fixes |
| v48-49 | 2 | Play Store compliance (target SDK 36) |
| v50-55 | 6 | More 16KB page size patches, signing, selective ABI filtering |
| v56-60 | 5 | expo-modules-core 16KB patching with patchelf, package rename |
| v61-65 | 5 | ABI complete filters, camera downgrade, diagnostic logging, quality fixes |

All 25 version bumps between v40 and v65 are **build/pipeline iterations**, not feature releases. Each bump corresponds to a Play Store submission attempt (required by Google's versionCode monotonicity). The only feature commit in this range is `f96a3a8` (Smart Pre-fill + OCR Confidence for v64).

No feature versions were skipped. The rapid version bumps are a natural consequence of the 16KB page size compliance pipeline.

---

## CROSS-CUTTING CONCERNS

### Memory Safety: Summary of Timer Cleanup

| File | Timer Type | Cleaned Up? | Risk |
|------|-----------|-------------|------|
| `cloud-sync.ts:32` | `setInterval` | ❌ NEVER | DORMANT (dead code) |
| `ProUpgrade.tsx:95` | `setTimeout` (navTimer) | ✅ useEffect return | None |
| `ProUpgrade.tsx:129` | `setTimeout` (timeoutRef) | ✅ clearTimeout on success/error/cancel | None |
| `useAuth.tsx:165` | `setTimeout` (OAuth) | ✅ clearTimeout in finish closure | None (even on unmount) |
| `_InvoiceLimitModal.tsx:70` | `setTimeout` (ad timeout) | ✅ useEffect return | None |
| `PlanContext.tsx:241` | `pollTimer` (declared, never set) | ✅ code checks before clearing | Dead var, no leak |
| `scanner.tsx:184` | `setTimeout` (OCR timeout) | ✅ Promise.race resolves/rejects | None (one-shot) |
| `ToastProvider.tsx:145` | `setTimeout` (dismiss) | ✅ clear in useEffect + on new toast | None |
| `MilestoneCelebration.tsx:195` | `setTimeout` (auto dismiss) | ✅ useEffect return | None |
| `useSuccessAnimation.tsx:117` | `setTimeout[]` (animations) | ✅ iterates and clears all | None |
| `analytics-events.ts:61` | `setTimeout` (abort) | ✅ clearTimeout immediately after | None |
| `useDebounce.ts:29` | `setTimeout` (debounce) | ✅ useEffect return | None |

**Verdict:** Timer management is generally excellent. Only `cloud-sync.ts` has an unmanaged interval, and it's dead code.

### Error Handling: try/catch Coverage in Critical Paths

| File | Pattern | Quality |
|------|---------|---------|
| `scanner.tsx` | try/catch on capture, analyze, auto-fill | ✅ Good — handles camera, API, storage errors |
| `ProUpgrade.tsx` | try/catch on purchase, restore | ✅ Good — timeout + error display + retry |
| `_layout.tsx` | try/catch on RevenueCat init, AdMob init | ✅ Good — both non-fatal |
| `PlanContext.tsx` | try/catch on Supabase write, RC listener | ✅ Good — best-effort, never crash |
| `useAuth.tsx` | try/catch on maybeCompleteAuthSession, OAuth | ✅ Good — graceful degradation |
| `ai.ts` (apiFetch) | try/catch on fetch, returns error object | ✅ Good — never throws |
| `ads.ts` | try/catch on init, load, show | ✅ Good — returns false on failure |
| `analytics-events.ts` | try/catch on every operation | ✅ Good — analytics never crashes app |

---

## ACTION ITEMS (Priority-Ordered)

### 🔴 P0 — Must Fix
- **[NONE]** — No P0 issues found. The known crash (TabLayout) is fixed.

### 🟡 P1 — Should Fix
1. **Add Sentry/react-native** (`@sentry/react-native`) for crash reporting. Initialize in root layout after `Purchases.configure()`. Even free tier captures unhandled errors + breadcrumbs. This is the #1 gap.
2. **Sync `user_engagement.is_premium`** during purchase flow. Add update to `writePremiumToSupabase()` in PlanContext.

### 🟡 P2 — Nice to Fix
3. **Remove `[isPremium]` dependency** from PlanContext RC useEffect → change to `[]`. Prevents wasteful re-subscription cycle.
4. **Add `isMounted` guard** to ProUpgrade async purchase callbacks (setPurchaseState after await).
5. **Archive or fix `cloud-sync.ts`** — the `setInterval` leak is dormant dead code. Either fix the cleanup or remove the file.
6. **Remove `pollTimer` dead variable** from PlanContext at line 241 and its cleanup at line 266.

### ⚪ P3 — Informational
7. **Add `global.addEventListener('unhandledrejection')`** handler in root layout for unhandled Promise rejections (Sentry would catch these automatically).
8. **Ensure `BOOT_*` diagnostic logs** are visible in release builds via a flag (currently gated by `__DEV__`).

---

## METHODOLOGY NOTES

- All findings backed by actual file reads and grep searches — no speculation
- Version gap investigation confirmed via `git log --oneline -50 --all -- mobile/`
- Three-plan-system gap confirmed by cross-referencing PlanContext writes vs smart-notifications reads
- Timer leak analysis done via comprehensive grep for all `setInterval`/`setTimeout` patterns, with manual verification of cleanup for each
- Error boundary and crash reporting analysis confirmed by grep for Sentry and unhandledrejection patterns
