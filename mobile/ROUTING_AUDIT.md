# 🔴 Routing Architecture Audit — InvoiceStudio Mobile

**Audit date:** 2026-06-02  
**Scope:** Expo Router / React Navigation structure — Foundation Build Phase 1  
**Framework:** Expo Router v3+ (file-based), Expo SDK 52+, `typedRoutes: true`  
**Severity legend:** 🔴 Critical — 🔶 High — 🟡 Medium — 🟢 Low

---

## 1. Route Inventory — Complete Map

### 1.1 Navigator Hierarchy (reconstructed from file system)

```
RootLayout (_layout.tsx)
└── <Stack headerShown={false} animation="fade">
    ├── (auth) group  ─── _layout.tsx (auth/unauth redirect)
    │   └── login       ─── re-exports from ../login.tsx
    │
    └── (app) group   ─── _layout.tsx (auth guard)
        ├── (tabs) group  ─── _layout.tsx (Tab Navigator)
        │   ├── index      ─── DashboardScreen
        │   ├── invoices   ─── InvoicesScreen
        │   ├── clients    ─── ClientsScreen
        │   └── settings   ─── SettingsScreen
        │
        ├── [invoice]      ─── InvoiceDetailScreen  (card, slide_from_right)
        ├── scanner         ─── ScannerScreen         (modal, slide_from_bottom)
        ├── ProUpgrade      ─── ProUpgradeScreen      (standard push)
        └── InvoiceLimitModal ─── ⚠️  ACCIDENTAL ROUTE (component, not screen)
```

### 1.2 Route Table

| # | Path / Route Name | Navigator | Auth Gated | Registration | Data Fetching | Params Typed |
|---|---|---|---|---|---|---|
| 1 | `/` → redirects to auth check | Root Stack | — | Auto (file-system) | — | — |
| 2 | `(auth)/login` | Auth Stack | No (auth entry) | ✅ | `signIn` / `signUp` from AuthContext | No |
| 3 | `(app)/(tabs)/index` | Tab Navigator | ✅ (session check in `(app)/_layout`) | ✅ | `apiFetch("/api/invoices?limit=200")` + analytics lib | No |
| 4 | `(app)/(tabs)/invoices` | Tab Navigator | ✅ (session check) | ✅ | `apiFetch("/api/invoices?limit=50")` | No |
| 5 | `(app)/(tabs)/clients` | Tab Navigator | ✅ (session check) | ✅ | `apiFetch("/api/clients")` | No |
| 6 | `(app)/(tabs)/settings` | Tab Navigator | ✅ (session check) | ✅ | `supabase.auth.getUser()` via context | No |
| 7 | `(app)/[invoice]` | App Stack (card) | ✅ (session check) | ✅ | `apiFetch("/api/invoices/${invoiceId}")` | ❌ `useLocalSearchParams()["invoice"]` — untyped |
| 8 | `(app)/scanner` | App Stack (modal) | ✅ (session check) | ✅ | POST `/api/ocr/receipt` with base64 image | No |
| 9 | `(app)/ProUpgrade` | App Stack (push) | ✅ (session check) | ✅ | RevenueCat `Purchases.getOfferings()` | No |
| 10 | `(app)/InvoiceLimitModal` | 🔴 **ACCIDENTAL ROUTE** | ✅ | 🔴 Auto-registered by file-system | N/A (component, not screen) | No |

---

## 2. 🔴 Critical Findings (P0 — BLOCKING)

### 2.1 CRITICAL: Ghost Screen Declarations in `(app)/_layout.tsx`

**File:** `mobile/app/(app)/_layout.tsx` — lines 30–35

```tsx
<Stack.Screen name="invoices" options={{ presentation: "modal" }} />
<Stack.Screen name="clients" options={{ presentation: "modal" }} />
<Stack.Screen name="settings" options={{ presentation: "modal" }} />
```

**Problem:** These refer to screen names `invoices`, `clients`, `settings` as direct children of the `(app)` Stack. But these screens live inside `(tabs)/`. Expo Router resolves them as `(tabs)/invoices`, not `invoices`. These `<Stack.Screen>` declarations are silently ignored — they match nothing. **Dead code that reveals a misunderstanding of the navigator nesting.**

Additionally, if these screens ever moved OR if Expo Router changed its name resolution logic, the tabs could suddenly become overridden as modals, breaking the entire tab navigation.

**Impact:** Confusion for future developers. Silent mismatch between declared layout and actual route structure. Risk of routing breakage on SDK upgrades.

**Fix:** Delete lines 30–32 entirely. Only keep Stack.Screen declarations for routes that are **direct children** of `(app)/_layout.tsx`: `scanner`, `[invoice]`, and `ProUpgrade`.

---

### 2.2 CRITICAL: Accidental Route — `InvoiceLimitModal.tsx` is a Navigable Screen

**File:** `mobile/app/(app)/InvoiceLimitModal.tsx`

Every `.tsx` file in the `app/` directory that exports a default component becomes a route. `InvoiceLimitModal` is a modal component imported and used **programmatically** in `invoices.tsx` — it should NOT be navigable via URL.

**Impact:**
- Users could deep-link to `/(app)/InvoiceLimitModal` and see an orphaned empty modal with no context.
- Pollutes the route tree with an invalid screen.
- Breaks `typedRoutes` type generation.

**Fix:** Move `InvoiceLimitModal.tsx` to `mobile/components/InvoiceLimitModal.tsx` and update the import in `invoices.tsx`. Alternatively, prefix the filename with `_` → `_InvoiceLimitModal.tsx` (Expo Router ignores `_`-prefixed files).

---

### 2.3 CRITICAL: `login.tsx` Exists at Two Conflicting Paths

**Files:**
- `mobile/app/login.tsx` — standalone login screen
- `mobile/app/(auth)/login.tsx` — re-exports from `../login` via `export { default } from "../login";`

**Problem:** Two file-system paths resolve to the same screen:
1. `/login` — directly accessible (outside any group)
2. `/(auth)/login` — inside the auth group

When the `(app)/_layout.tsx` redirects unauthenticated users to `/login`, which path does Expo Router use? The root-level `/login` is ambiguous because both `(auth)/login` AND the bare `login.tsx` exist. The `(auth)/_layout.tsx` also declares `<Stack.Screen name="login" />` which explicitly registers the auth-group version. But the root `/login` remains navigable, bypassing the auth group's Stack configuration.

**Impact:** Route ambiguity. Two different navigation paths to the same screen with potentially different layout wrappers (AuthLayout vs no layout). Could cause unexpected back-navigation behavior.

**Fix:** Delete `mobile/app/login.tsx` entirely. Keep only `(auth)/login.tsx` (which should contain the actual component, not a re-export). Update the redirect in `(app)/_layout.tsx` from `/login` to `/(auth)/login`.

---

### 2.4 CRITICAL: Missing Invoice Creation Screen

**File:** `mobile/app/(app)/(tabs)/invoices.tsx` — line ~80

```tsx
const handleNewInvoice = useCallback(() => {
  if (!quota.canCreate) {
    setLimitModalVisible(true);
    return;
  }
  // TODO: navigare alla schermata di creazione fattura
}, [quota.canCreate]);
```

**Problem:** The primary CTA of the invoices screen (`+ Nuova Fattura`) leads to a **TODO comment**. There is NO invoice creation form screen anywhere in the route tree. Users who have quota available see nothing happen when they tap "Nuova Fattura."

**Impact:** Core product flow is broken. Users cannot create invoices from mobile.

**Fix:** Create `mobile/app/(app)/new-invoice.tsx` with form screen. Wire `handleNewInvoice` to `router.push("/(app)/new-invoice")`.

---

## 3. 🔶 High Severity Findings (P1)

### 3.1 HIGH: `[invoice]` Route Param Is Completely Untyped

**File:** `mobile/app/(app)/[invoice].tsx` — lines 47–50

```tsx
const { invoice } = useLocalSearchParams();
const invoiceId = typeof invoice === "string" ? invoice : "";
```

**Problem:** Despite `"typedRoutes": true` in `app.json`, the dynamic segment `[invoice]` has no type declarations. The code manually narrows `string | string[]` to `string`. Expo Router with `typedRoutes` expects an `expo-router.d.ts` or `.expo/types/` generated types, but there's no explicit typing.

**Impact:** No compile-time guarantee that `invoice` is a valid ID. Silent failure if deep-linked without params.

**Fix:** Either:
- Add an explicit `Params` type export in `[invoice].tsx` (Expo Router convention)
- Add `export type { InvoiceDetailParams }` with the expected shape
- OR validate and redirect with `router.back()` + error toast earlier in the flow

---

### 3.2 HIGH: Deep Linking Has No Path Validation

**File:** `mobile/app/_layout.tsx` — `NotificationDeepLinkHandler`

```tsx
const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
  const data = response.notification.request.content.data as any;
  if (data?.deepLink) {
    router.push(data.deepLink as any);  // ← no validation
  }
});
```

**Problem:** Deep links from push notifications are `router.push`'d directly without any validation. A malicious or malformed payload could crash the app or navigate to non-existent routes. The deep link format strings found in the codebase: `/(app)/${invoice.id}`, `/(app)/invoices`.

**Impact:** Potential app crash from invalid deep links. No error boundary. Security surface for crafted push notification payloads.

**Fix:** Validate `deepLink` against a whitelist of known route patterns before pushing. Wrap in try/catch with fallback to dashboard.

---

### 3.3 HIGH: `scanner.tsx` Has No Session Validation — Relies on Layout Guard Only

**File:** `mobile/app/(app)/scanner.tsx`

The scanner performs authenticated API calls (`apiFetch("/api/ocr/receipt", ...)`) but has **no direct session check**. The `(app)/_layout.tsx` guards the entire group, but if the session expires *during* use (e.g., the user leaves the app open, comes back after token expiry), the scanner will fail silently when calling the API.

The `apiFetch` helper returns `{ data: null, error: "Non autenticato", status: 401 }` — but `scanner.tsx` swallows this error (`if (apiError || !data)`) with a generic message and doesn't redirect to login.

**Impact:** Users see "Estrazione non riuscita. Prova con una foto più nitida" when the real problem is an expired session. Misleading UX.

**Fix:** Check for 401 status explicitly in `scanner.tsx` and trigger a navigation to login when detected.

---

### 3.4 HIGH: No Error Boundaries on Any Screen

**Impact:** Any unhandled React error crashes the entire app to a blank white screen. No fallback UI, no recovery path, no error reporting.

**Fix:** Wrap `<Stack />` in root `_layout.tsx` with an Error Boundary component that shows an error message with a "Go to Dashboard" button.

---

## 4. 🟡 Medium Severity Findings (P2)

### 4.1 MEDIUM: `useIsFocused` Import in Scanner Causes Render Dependencies on Tab Changes

**File:** `mobile/app/(app)/scanner.tsx` — imports `useIsFocused` from `@react-navigation/native`

Expo Router uses Expo Router's own navigation primitives — importing from `@react-navigation/native` couples the code to the underlying React Navigation implementation. This will break if Expo Router ever changes its internal navigator.

**Fix:** Use Expo Router's own `useFocusEffect` or the `usePathname` hook instead.

---

### 4.2 MEDIUM: Tab Screens Use Hardcoded Colors Instead of `useTheme()`

**Files:** All `(app)/(tabs)/*.tsx` screens + `login.tsx` + `ProUpgrade.tsx`

The ThemeProvider system and `useTheme()` hook exist and are properly set up, but the majority of screens hardcode color values (`"#0a0b0f"`, `"#f0f0f2"`, etc.) instead of using the theme tokens. Only `scanner.tsx` correctly imports and uses `COLORS` from `constants/theme`. The `milo.tsx` UI kit correctly uses `useTheme()`.

**Impact:** Dark/light mode switching is broken — the UI doesn't respond to theme changes. The ThemeContext infrastructure is wasted.

**Fix:** Migrate all screens to `useTheme().colors`. Replace all hardcoded hex values with theme tokens.

---

### 4.3 MEDIUM: No Route for Client Detail

**Files:** `(app)/(tabs)/clients.tsx`

The clients screen renders a FlatList of clients but each item is **non-interactive** — there's no `onPress` handler, no navigation to a client detail screen. The `[invoice]` detail screen exists but there's no equivalent `(app)/[client]` route.

**Impact:** Users can see their clients but can't view/edit client details.

**Fix:** Create `(app)/[client].tsx` and add `onPress` navigation in `clients.tsx`.

---

### 4.4 MEDIUM: `ProUpgrade.tsx` Uses `router.back()` Without Guard

**File:** `mobile/app/(app)/ProUpgrade.tsx` — lines 79, 96

After a successful purchase or restore, the screen calls `router.back()`. If the user deep-linked directly to the ProUpgrade screen (e.g., from a push notification or scanner paywall), `router.back()` may navigate to an unexpected screen or exit the app.

**Fix:** Use `router.replace("/(app)/(tabs)")` or `router.dismissAll()` for definitive navigation after purchase completion.

---

### 4.5 MEDIUM: Scanner Component Churn — `useIsFocused` Unmounts Camera

**File:** `mobile/app/(app)/scanner.tsx`

The camera is conditionally rendered based on `isFocused`:

```tsx
{isFocused ? (
  <CameraView ref={cameraRef} ... />
) : (
  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.background }]} />
)}
```

**Problem:** Every tab switch destroys and recreates the CameraView, causing a ~200-400ms camera initialization delay each time the user returns to the Scanner tab (if accessed via tab). Since scanner is a push screen (not a tab), this mostly works, but `useIsFocused` is unnecessary since the scanner is always focused when mounted as a push screen.

**Fix:** Remove `useIsFocused` from scanner. It's only needed for tab screens.

---

### 4.6 MEDIUM: `app.json` Scheme Not Documented/Tested

**File:** `mobile/app.json` — `"scheme": "invoicestudio"`

The scheme is defined but there's no explicit `expo-router` deep linking configuration (no `linking` key, no path mappings). Expo Router auto-generates path mappings from the file system, which works, but:
- No `android/app/src/main/AndroidManifest.xml` intent-filter audit performed
- No iOS `associatedDomains` verification
- No test deep link URLs documented

**Fix:** Document tested deep link formats. Add Android intent-filter validation. Consider adding `expo-router` `linking` config if custom path transforms are needed.

---

## 5. 🟢 Low Severity Findings (P3)

### 5.1 LOW: `(auth)/_layout.tsx` Has Comment in Italian — Rest of Code Mixed

The file has Italian comments ("// Verifica lo stato di autenticazione") while some other lib files use English. No functional impact but inconsistency.

### 5.2 LOW: `components/ui/milo.tsx` Defines `MiloEmptyState` But No Screen Uses It

The `MiloEmptyState` component exists in the UI kit but the screens (`clients.tsx`, `invoices.tsx`) use their own inline empty states instead. The UI kit is underutilized.

### 5.3 LOW: `(app)/_layout.tsx` Declares `initializePushNotifications` Twice

- Once in the `useEffect` inside `(app)/_layout.tsx` (logged-in users)
- Once in the `NotificationDeepLinkHandler` inside root `_layout.tsx`

This means `initializePushNotifications()` may be called redundantly. The function has internal guards (`Device.isDevice` check), so it's harmless but wasteful.

### 5.4 LOW: `tabBarIcon` Uses Emojis

The tabs use emoji characters as icons: `"📊"`, `"📄"`, `"👥"`, `"⚙️"`. These render inconsistently across Android versions and OEM skins. Consider using `@expo/vector-icons` or custom SVG icons.

### 5.5 LOW: No `loading.tsx` or `error.tsx` Co-Located Files

Expo Router supports `loading.tsx` and `error.tsx` alongside route files for Suspense boundaries and error states. None are used.

---

## 6. Navigation Anti-Patterns Catalog

### 6.1 ANTI-PATTERN: Skeleton Screen in `(app)/_layout.tsx` Declarations

Described in §2.1. Declaring `<Stack.Screen>` for routes that aren't direct children of the parent stack.

### 6.2 ANTI-PATTERN: State-Driven Navigation with `router.push(data.deepLink as any)`

Described in §3.2. Using raw user-data strings to navigate without validation.

### 6.3 ANTI-PATTERN: Component File in `app/` Directory

Described in §2.2. `InvoiceLimitModal.tsx` is a reusable component, not a screen — it belongs in `components/`.

### 6.4 ANTI-PATTERN: `export { default }` Re-Export Proxy

Described in §2.3. `(auth)/login.tsx` is a thin proxy that re-exports `../login`. This creates route ambiguity and adds indirection for no benefit.

### 6.5 ANTI-PATTERN: `router.back()` for Definitive Navigation

Described in §4.4. After completing a flow that changes state (purchase, logout), `router.back()` is fragile. Prefer `router.replace()` or `router.dismissAll()`.

---

## 7. Data Fetching Patterns Summary

| Screen | Pattern | Loading State | Error State | Empty State | Refetch Support |
|---|---|---|---|---|---|
| Dashboard (index) | `useCallback` + `apiFetch` on mount | ✅ ActivityIndicator | ❌ No error UI | ❌ Shows empty KPIs | ✅ Pull-to-refresh |
| Invoices (list) | `useCallback` + `apiFetch` on mount | ✅ ActivityIndicator | ❌ Errors swallowed | ✅ Custom empty state | ✅ Pull-to-refresh |
| Clients (list) | `useCallback` + `apiFetch` on mount | ✅ ActivityIndicator | ❌ Errors swallowed | ✅ Custom empty state | ✅ Pull-to-refresh |
| Invoice Detail | `useEffect` + `apiFetch` | ✅ ActivityIndicator | ✅ "Fattura non trovata" | N/A | ❌ No pull-to-refresh |
| Scanner | Promise + `apiFetch` POST | ✅ Analyzing animation | ✅ Error banner | N/A | N/A |
| Settings | Context (useAuth) | ❌ No loading for settings load | ❌ No error for notification pref load | N/A | N/A |

**Key gap:** Only one screen has error UI for data fetching failures. All list screens silently swallow errors.

---

## 8. Route Parameter Typing

```
✅ typedRoutes enabled in app.json: YES
❌ Explicit param types exported from route files: NO
❌ expo-router.d.ts custom type declarations: NOT FOUND
⚠️  Dynamic segment [invoice] param: untyped (string | string[])
```

Despite `"experiments": { "typedRoutes": true }`, the codebase doesn't export param types from routes. Expo Router's `typedRoutes` generates `.expo/types/router.d.ts` at build time, but the screens don't leverage TypeScript for param validation.

---

## 9. Summary — Severity Matrix

| # | Finding | Severity | Effort | Priority |
|---|---|---|---|---|
| 2.1 | Ghost Stack.Screen declarations in `(app)/_layout.tsx` | 🔴 Critical | 5 min | P0 |
| 2.2 | `InvoiceLimitModal.tsx` is accidental route | 🔴 Critical | 5 min | P0 |
| 2.3 | `login.tsx` route duplication | 🔴 Critical | 10 min | P0 |
| 2.4 | Missing invoice creation screen | 🔴 Critical | 4–8 hrs | P0 |
| 3.1 | `[invoice]` route param untyped | 🔶 High | 15 min | P1 |
| 3.2 | Deep link path validation missing | 🔶 High | 30 min | P1 |
| 3.3 | Scanner no session expiry handling | 🔶 High | 20 min | P1 |
| 3.4 | No error boundaries | 🔶 High | 30 min | P1 |
| 4.1 | `useIsFocused` from wrong package in scanner | 🟡 Medium | 10 min | P2 |
| 4.2 | Hardcoded colors bypass ThemeContext | 🟡 Medium | 3–4 hrs | P2 |
| 4.3 | Missing client detail route | 🟡 Medium | 2–4 hrs | P2 |
| 4.4 | `router.back()` fragility in ProUpgrade | 🟡 Medium | 5 min | P2 |
| 4.5 | `useIsFocused` unnecessary in scanner | 🟡 Medium | 5 min | P2 |
| 4.6 | Deep linking untested/undocumented | 🟡 Medium | 1–2 hrs | P2 |
| 5.1–5.5 | Language inconsistency, unused components, icon quality, missing loading.tsx | 🟢 Low | 4–6 hrs total | P3 |

---

## 10. Immediate Action Plan

### Sprint 0 — Fix CRITICALs (before any feature work)

1. **Delete ghost `<Stack.Screen>` entries** from `(app)/_layout.tsx` (lines 30–32)
2. **Move `InvoiceLimitModal.tsx`** to `mobile/components/InvoiceLimitModal.tsx`
3. **Delete `app/login.tsx`**, inline the login component into `(auth)/login.tsx`, fix redirect path
4. **Create `(app)/new-invoice.tsx`** stub (at minimum a placeholder screen with a "Coming Soon" message so the CTA isn't dead)

### Sprint 1 — Fix HIGHs

5. Add param type export to `[invoice].tsx`
6. Add deep link validation to `NotificationDeepLinkHandler`
7. Add 401 detection to scanner error handler
8. Wrap `<Stack />` in RootLayout with an ErrorBoundary

### Sprint 2 — Address MEDIUMs

9. Replace `useIsFocused` import in scanner with Expo Router equivalent
10. Theme migration plan for screen hardcoded colors
11. Create `(app)/[client].tsx`
12. Replace `router.back()` with `router.replace()` in ProUpgrade

---

*Audit produced by Code Quality Architect — Phase 1: Discovery & Audit complete.*
