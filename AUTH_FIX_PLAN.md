# AUTH FIX PLAN — Complete Forensic Audit

## Philosophy
Auth is the front door. If the door is broken, nobody enters. Every auth issue is a P0.

---

## ISSUE 1: No Password Reset Flow

**Severity**: P0 — CRITICAL
**Impact**: Users who forget password are permanently lost. 100% churn.
**Root Cause**: Zero UI and zero API route for password recovery.
**Evidence**: `@/frontend/src/app/(auth)/login/page.tsx:134-139` — no "Forgot password?" link. No `/forgot-password` route exists in project.
**Files to modify**:
- `@/frontend/src/app/(auth)/login/page.tsx` — add "Password dimenticata?" link
- Create `@/frontend/src/app/(auth)/forgot-password/page.tsx` — email input form
- Create `@/frontend/src/app/auth/reset-password/page.tsx` — new password form
**Fix**:
```tsx
// login.tsx — add after password field
<p className="text-right text-xs">
  <Link href="/forgot-password" className="text-[#6c63ff]">Password dimenticata?</Link>
</p>

// forgot-password.tsx — call supabase.auth.resetPasswordForEmail
// reset-password.tsx — call supabase.auth.updateUser({ password })
```
**Effort**: 4 hours
**Priority**: 1 (do first)

---

## ISSUE 2: No "Resend Confirmation Email"

**Severity**: P0 — CRITICAL
**Impact**: User misses confirmation email → no recourse → permanent churn.
**Root Cause**: Signup page redirects to login with success message but offers no resend option.
**Evidence**: `@/frontend/src/app/(auth)/signup/page.tsx:40-41` — `router.push("/login?signup=success")` with no resend path.
**Files to modify**:
- `@/frontend/src/app/(auth)/login/page.tsx` — add "Non hai ricevuto l'email? Reinvia" link
**Fix**: Add link that calls `supabase.auth.resend({ type: 'signup', email })`
**Effort**: 1 hour
**Priority**: 2

---

## ISSUE 3: No Terms Acceptance During Signup

**Severity**: P1 — LEGAL
**Impact**: Contracts unenforceable. GDPR compliance questionable.
**Root Cause**: Signup form has no checkbox for Terms of Service / Privacy Policy.
**Evidence**: `@/frontend/src/app/(auth)/signup/page.tsx:53-123` — form has name, email, password fields only.
**Files to modify**:
- `@/frontend/src/app/(auth)/signup/page.tsx` — add checkbox + links
**Fix**: Add required checkbox: "Accetto i Termini di Servizio e la Privacy Policy" with links to `/terms` and `/privacy`
**Effort**: 30 minutes
**Priority**: 3

---

## ISSUE 4: Signup Error Messages Are Raw Supabase Strings

**Severity**: P1 — TRUST
**Impact**: Users see technical errors like "User already registered" instead of Italian.
**Root Cause**: No translation map for signup errors (unlike login which has `translateAuthError`).
**Evidence**: `@/frontend/src/app/(auth)/signup/page.tsx:34-36` — `setError(authError.message)` directly, no translation.
**Files to modify**:
- `@/frontend/src/app/(auth)/signup/page.tsx` — add `translateSignupError()` function
**Fix**: Map common Supabase signup errors to Italian:
- "User already registered" → "Esiste già un account con questa email"
- "Password should be at least 10 characters" → "La password deve avere almeno 10 caratteri"
- "Unable to validate email address: invalid format" → "Formato email non valido"
**Effort**: 30 minutes
**Priority**: 4

---

## ISSUE 5: No Rate Limiting on Auth Endpoints

**Severity**: P1 — SECURITY
**Impact**: Brute force attacks possible. Supabase will rate-limit but UX is bad.
**Root Cause**: No custom rate limiting on login/signup API routes.
**Evidence**: Login is client-side Supabase call; no server-side rate limit wrapper.
**Files to modify**:
- `@/frontend/src/app/(auth)/login/page.tsx` — add client-side attempt counter + cooldown
- `@/frontend/src/app/(auth)/signup/page.tsx` — same
**Fix**: After 3 failed attempts, show "Troppi tentativi. Riprova tra 60 secondi" and disable button for 60s.
**Effort**: 1 hour
**Priority**: 5

---

## ISSUE 6: Session Persistence Untested on Mobile

**Severity**: P2 — RELIABILITY
**Impact**: Mobile users may lose session on browser close due to cookie settings.
**Root Cause**: Supabase SSR cookies use default settings. On mobile browsers, sessions may not persist.
**Evidence**: `@/frontend/src/middleware.ts:34-46` — cookie `options` are passed through from Supabase without explicit `maxAge` or `persistSession` configuration.
**Files to modify**:
- `@/frontend/src/lib/supabase/client.ts` — add `persistSession: true`
- `@/frontend/src/middleware.ts` — ensure cookies have proper `maxAge`
**Fix**: Configure Supabase client with `auth: { persistSession: true, autoRefreshToken: true }`
**Effort**: 1 hour
**Priority**: 6

---

## ISSUE 7: Auth Callback Error Handling Is Silent

**Severity**: P2 — UX
**Impact**: If email confirmation link is invalid/expired, user is silently redirected to login with no explanation.
**Root Cause**: `@/frontend/src/app/auth/callback/route.ts:33-37` — on error, falls through to redirect without showing error message.
**Evidence**: Lines 33-37 check `if (!error)` but don't handle the error case meaningfully.
**Files to modify**:
- `@/frontend/src/app/auth/callback/route.ts` — redirect with error param
- `@/frontend/src/app/(auth)/login/page.tsx` — show error from query param
**Fix**: `return NextResponse.redirect(\`${origin}/login?error=confirmation_expired\`)` and show message on login page.
**Effort**: 1 hour
**Priority**: 7

---

## ISSUE 8: Multi-Tab Logout Not Synced

**Severity**: P2 — UX
**Impact**: User logs out in Tab A, Tab B still shows authenticated UI until refresh.
**Root Cause**: No `storage` event listener for auth state across tabs.
**Evidence**: No `storage` listener in any auth-related component.
**Files to modify**:
- `@/frontend/src/app/(dashboard)/layout.tsx` — add `storage` event listener
**Fix**: Listen for `supabase.auth.onAuthStateChange` which broadcasts across tabs, or add custom `storage` event for logout.
**Effort**: 1 hour
**Priority**: 8

---

## ISSUE 9: "Remember Me" Missing

**Severity**: P3 — NICE TO HAVE
**Impact**: Users on shared computers may want shorter sessions. Users on personal devices want longer sessions.
**Root Cause**: No "Remember me" checkbox. All sessions use Supabase default expiry.
**Evidence**: Login form has no such option.
**Files to modify**:
- `@/frontend/src/app/(auth)/login/page.tsx` — add checkbox
- Pass preference to `signInWithPassword` if Supabase supports it, or manage manually
**Effort**: 2 hours
**Priority**: 9 (post-V23)

---

## ISSUE 10: Auto-Generated Org Name Can Be NULL

**Severity**: P2 — POLISH
**Impact**: If `full_name` is null/empty, org name becomes "'s Studio" which looks broken.
**Root Cause**: `@/backend/migration.sql` — `handle_new_user()` uses `NEW.raw_user_meta_data->>'full_name' || '''s Studio'` without null check.
**Evidence**: SQL trigger concatenates without COALESCE.
**Files to modify**:
- `@/backend/migration.sql` — fix trigger
**Fix**: `COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utente') || ' Studio'`
**Effort**: 15 minutes
**Priority**: 10

---

## Implementation Order

| Order | Issue | Effort | Impact |
|-------|-------|--------|--------|
| 1 | Password Reset Flow | 4h | CRITICAL |
| 2 | Resend Confirmation Email | 1h | CRITICAL |
| 3 | Terms Acceptance | 30m | LEGAL |
| 4 | Signup Error Translation | 30m | TRUST |
| 5 | Rate Limiting | 1h | SECURITY |
| 6 | Auth Callback Error Handling | 1h | UX |
| 7 | Session Persistence | 1h | RELIABILITY |
| 8 | Multi-Tab Logout | 1h | UX |
| 9 | Auto-Generated Org Name Fix | 15m | POLISH |
| 10 | Remember Me | 2h | NICE |

**Total Auth Fix Effort: ~12 hours**

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
