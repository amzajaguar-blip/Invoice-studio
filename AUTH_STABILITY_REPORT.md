# AUTH STABILITY REPORT — Invoice Studio V23

**Date**: 2026-06-02
**Auditor**: BEHEMOTH / Senior Auth Engineer
**Scope**: signup, login, logout, session restore, token refresh, persistence, email confirmation, password reset, auth callback, post-login redirect

---

## Critical Issues (P0)

### A1: No Password Reset Flow
- **Problem**: No `/forgot-password` page exists. No "Password dimenticata?" link on login. Users who forget password are permanently locked out.
- **Impact**: 100% churn for forgotten passwords. Google Play tester will flag as broken.
- **Files**: `login/page.tsx`, missing `forgot-password/page.tsx`, missing `auth/reset-password/page.tsx`
- **Fix**: Build complete flow using `supabase.auth.resetPasswordForEmail` and `supabase.auth.updateUser({ password })`.
- **Effort**: 4h

### A2: No Resend Confirmation Email
- **Problem**: After signup, user is told "Controlla la tua email" but has no way to resend if email is lost/spam.
- **Impact**: User misses email = permanent dead end. Cannot activate account.
- **Files**: `login/page.tsx` (needs resend link)
- **Fix**: Add "Non hai ricevuto l'email? Reinvia" link calling `supabase.auth.resend({ type: 'signup', email })`.
- **Effort**: 30m

### A3: Signup Error Messages in English (Raw Supabase)
- **Problem**: `signup/page.tsx:35` sets `authError.message` directly without translation. User sees "User already registered", "Password should be at least 10 characters".
- **Impact**: Trust kill. App claims to be Italian but speaks English on errors.
- **Files**: `signup/page.tsx`
- **Fix**: Add `translateSignupError()` map (same pattern as login's `translateAuthError`).
- **Effort**: 30m

### A4: No Terms Acceptance During Signup
- **Problem**: No checkbox for Terms/Privacy. No links to `/terms` or `/privacy`. Contracts unenforceable. GDPR risk.
- **Impact**: Legal liability. Play Store may reject for missing privacy consent.
- **Files**: `signup/page.tsx`
- **Fix**: Add required checkbox with links. Block submission if unchecked.
- **Effort**: 30m

---

## High Issues (P1)

### B1: Auth Callback Silent Fail on Expired Link
- **Problem**: `auth/callback/route.ts:33-40` — on `exchangeCodeForSession` error, silently redirects to `/login` with no error message.
- **Impact**: User clicks expired link, lands on login with zero feedback. Thinks link worked but isn't logged in. Confusion loop.
- **Files**: `auth/callback/route.ts`, `login/page.tsx`
- **Fix**: Redirect to `login?error=confirmation_expired` and show translated message.
- **Effort**: 30m

### B2: Session Persistence Not Explicitly Configured
- **Problem**: `client.ts:15-18` creates `createBrowserClient` without `auth.persistSession` or `autoRefreshToken` config. On mobile browsers (especially iOS Safari with ITP), sessions may be lost on app restart.
- **Impact**: User closes app, reopens = logged out. Tester thinks auth is broken.
- **Files**: `lib/supabase/client.ts`
- **Fix**: Add `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`.
- **Effort**: 15m

### B3: No Multi-Tab Logout Synchronization
- **Problem**: User logs out in Tab A. Tab B still shows authenticated UI indefinitely until refresh.
- **Impact**: Security issue. User thinks they're logged out but another tab shows their data.
- **Files**: `layout.tsx` (dashboard)
- **Fix**: Subscribe to `supabase.auth.onAuthStateChange` and redirect on SIGNED_OUT event.
- **Effort**: 30m

### B4: Post-Login Redirect Goes to Empty Dashboard
- **Problem**: `middleware.ts:67` and `auth/callback/route.ts:5` redirect to `/dashboard`. New user sees empty dashboard with 0 invoices, empty chart, generic promo.
- **Impact**: Activation cliff. User doesn't know what to do. Dashboard is a dead end for new users.
- **Files**: `middleware.ts`, `auth/callback/route.ts`
- **Fix**: Redirect authenticated users to `/scanner` instead. Add `/scanner` to allowed redirects.
- **Effort**: 15m

---

## Medium Issues (P2)

### C1: No Rate Limiting on Auth Forms
- **Problem**: Unlimited login/signup attempts. Brute force possible.
- **Impact**: Security risk. Supabase will rate-limit but UX degrades.
- **Files**: `login/page.tsx`, `signup/page.tsx`
- **Fix**: After 3 failed attempts, disable button for 60 seconds with countdown.
- **Effort**: 1h

### C2: Login Form Uses `window.location.assign` Instead of Router
- **Problem**: `login/page.tsx:60` uses `window.location.assign(redirect)`. This causes a full page reload instead of client-side navigation.
- **Impact**: Slower transition, potential state loss, jarring UX.
- **Files**: `login/page.tsx`
- **Fix**: Use `router.push(redirect)` with `router.refresh()`.
- **Effort**: 5m

### C3: No "Remember Me" Option
- **Problem**: All sessions use Supabase default expiry (1 hour JWT, 1 week refresh). Users on personal devices may want longer sessions.
- **Impact**: Frequent re-login annoys power users.
- **Files**: `login/page.tsx`
- **Fix**: Add checkbox. If checked, extend session by setting custom cookie maxAge. (Optional: Supabase doesn't natively support this, but cookie options can be tweaked in middleware.)
- **Effort**: 2h

---

## Low Issues (P3)

### D1: Auth Layout Has No Back Navigation
- **Problem**: Auth pages are modal-like but user can't go back to landing page.
- **Impact**: Minor UX friction.
- **Files**: `layout.tsx` (auth)
- **Fix**: Add "← Torna al sito" link.
- **Effort**: 15m

### D2: Signup Form Missing Password Strength Indicator
- **Problem**: Password field says "Almeno 10 caratteri" but gives no real-time feedback.
- **Impact**: Users submit weak passwords, get rejected after form submission.
- **Files**: `signup/page.tsx`
- **Fix**: Add real-time strength bar (optional, low priority).
- **Effort**: 1h

---

## Summary Table

| ID | Issue | Severity | Effort | Status |
|----|-------|----------|--------|--------|
| A1 | Password reset missing | P0 | 4h | **TODO** |
| A2 | Resend confirmation missing | P0 | 30m | **TODO** |
| A3 | Signup errors in English | P0 | 30m | **TODO** |
| A4 | No terms acceptance | P0 | 30m | **TODO** |
| B1 | Callback silent fail | P1 | 30m | **TODO** |
| B2 | Session persistence | P1 | 15m | **TODO** |
| B3 | Multi-tab logout sync | P1 | 30m | **TODO** |
| B4 | Redirect to empty dashboard | P1 | 15m | **TODO** |
| C1 | No rate limiting | P2 | 1h | **TODO** |
| C2 | window.location.assign | P2 | 5m | **TODO** |

---

*Report generated by BEHEMOTH*
