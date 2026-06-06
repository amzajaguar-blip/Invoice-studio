# InvoiceStudio — Authentication Forensics Report

## Document Purpose
Forensic audit of authentication system with severity ratings (P0-P3).

---

## FINDINGS SUMMARY

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | Email confirmation enabled but SMTP not configured | **P1** | Signup uses `emailRedirectTo`, login shows "Email non ancora verificata" |
| 2 | No password reset flow | **P0** | Zero UI/code for password reset; users permanently locked out if forgetting password |
| 3 | No "Remember me" option | **P1** | Session expires with browser; poor UX for returning users |
| 4 | Onboarding completely missing after signup | **P1** | Redirect to /login?signup=success → no guided setup |
| 5 | No onboarding for organization setup | **P1** | Auto-created org uses placeholder name; user never prompted to customize |
| 6 | Auth state persisted via cookies (good) | **—** | @supabase/ssr handles refresh automatically |
| 7 | Session refresh works via middleware | **—** | `getUser()` in middleware validates JWT on every request |
| 8 | Users stored in auth.users with metadata | **—** | `full_name` stored in `raw_user_meta_data` |
| 9 | org_members table links auth.users to organizations | **—** | RLS-based multi-tenant architecture |
| 10 | No separate profiles table | **P2** | User profile data scattered in auth metadata + org name |
| 11 | Login error messages are translated (good) | **—** | Italian translations for common Supabase errors |
| 12 | Password minimum 10 chars enforced | **—** | Signup form has `minLength={10}` |
| 13 | No rate limiting on auth endpoints | **P2** | Login/signup API routes have no rate limiting |
| 14 | Dangerous auto-org creation trigger | **P1** | `handle_new_user()` uses `NEW.raw_user_meta_data->>'full_name'` which can be NULL |
| 15 | No email verification resend | **P2** | Users who don't receive email have no UI option to resend |

---

## DETAILED FORENSICS

### 1. REGISTRATION

**Code**: `@/frontend/src/app/(auth)/signup/page.tsx:19-42`

```typescript
const { error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: name },
    emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
  },
});
```

**Analysis**:
- Creates user in `auth.users` with email confirmation required
- Stores `full_name` in user metadata
- Redirects to `/login?signup=success` after signup
- Password minimum enforced at UI level (10 chars)

**Issues**:
- No server-side validation of name/email format beyond HTML5 validation
- No honeypot or CAPTCHA → vulnerable to bot registration
- No password strength indicator

---

### 2. LOGIN

**Code**: `@/frontend/src/app/(auth)/login/page.tsx:43-61`

```typescript
const { error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**Analysis**:
- Standard Supabase password login
- Error messages translated to Italian
- After login: `window.location.assign(redirect)` (full page reload)

**Issues**:
- No rate limiting on login attempts
- No account lockout after failed attempts
- No "Forgot password?" link
- No "Remember me" checkbox → session lost when browser closes

---

### 3. LOGOUT

**Code**: `@/frontend/src/app/(dashboard)/layout.tsx:34-39`

```typescript
const handleLogout = async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.push("/login");
  router.refresh();
};
```

**Analysis**:
- Standard Supabase signOut
- Redirects to login page
- No "Are you sure?" confirmation

---

### 4. SESSION PERSISTENCE

**Code**: `@/frontend/src/lib/supabase/client.ts:13-19`

```typescript
export function createClient() {
  if (client) return client;
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
```

**Analysis**:
- Uses `@supabase/ssr` createBrowserClient
- Cookies persist session across browser restarts
- Singleton pattern prevents multiple client instances

**Code**: `@/frontend/src/middleware.ts:52-55`

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
```

**Analysis**:
- `getUser()` validates JWT and auto-refreshes tokens
- Called on every request via middleware
- Session should persist correctly

---

### 5. EMAIL VERIFICATION

**Status**: ENABLED

**Code**: `@/frontend/src/app/(auth)/login/page.tsx:72-76`

```typescript
{justSignedUp && (
  <div className="bg-[rgba(34,197,94,0.08)] ...">
    Account creato! Controlla la tua email per verificarlo, poi accedi.
  </div>
)}
```

**Code**: `@/frontend/src/app/(auth)/login/page.tsx:14-15`

```typescript
"Email not confirmed": "Email non ancora verificata. Controlla la tua casella di posta."
```

**Analysis**:
- Email confirmation is required (Supabase default)
- Users see Italian error if trying to login before confirming
- Confirmation link redirects to `/auth/callback?next=/dashboard`

**Issue**: No UI to resend confirmation email

---

### 6. SMTP CONFIGURATION

**Status**: NOT CONFIGURED IN CODE

**Analysis**:
- No SMTP credentials in environment variables
- No custom email templates in code
- Relies on Supabase default email service (shared IP, often spam-filtered)
- No DKIM/SPF configuration visible

**Risk**: Confirmation emails may land in spam or be delayed

---

### 7. PASSWORD RESET

**Status**: COMPLETELY MISSING

**Analysis**:
- No `/forgot-password` page
- No password reset link on login page
- No password reset API route
- No email template for password reset

**Impact**: Users who forget their password are permanently locked out

---

### 8. REMEMBER ME

**Status**: NOT IMPLEMENTED

**Analysis**:
- No "Remember me" checkbox on login
- Session cookie lifetime controlled by Supabase default (1 hour)
- Users must re-login frequently

---

### 9. REFRESH TOKENS

**Status**: HANDLED AUTOMATICALLY

**Code**: `@/frontend/src/middleware.ts:26-50`

```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        // ... cookie management
      },
    },
  }
);
```

**Analysis**:
- `@supabase/ssr` handles refresh automatically
- Refresh token stored in cookie
- Validated on every request via middleware

---

### 10. ONBOARDING AFTER SIGNUP

**Status**: BROKEN / MISSING

**Flow**:
1. User signs up → redirected to `/login?signup=success`
2. User checks email → clicks confirmation link
3. `/auth/callback` → `/dashboard`
4. Dashboard shows empty state with generic welcome

**Issues**:
- No guided tour
- No profile completion prompt
- No business info setup (VAT number, address, logo)
- No sample invoice
- No "Add your first client" wizard
- Organization name is auto-generated: "{full_name}'s Studio" (can be NULL)

**Code**: `@/backend/migration.sql:417-418`

```sql
INSERT INTO public.organizations (name, plan)
VALUES (NEW.raw_user_meta_data->>'full_name' || '''s Studio', 'free')
```

**Bug**: If `full_name` is NULL, org name becomes `'s Studio`

---

## VERIFICATION CHECKLIST

| Question | Answer | Evidence |
|----------|--------|----------|
| Is registration creating users? | **YES** | `supabase.auth.signUp()` in signup/page.tsx |
| Is email confirmation enabled? | **YES** | Error message "Email not confirmed" handled |
| Are confirmation emails sent? | **YES (via Supabase)** | No SMTP config → uses Supabase default |
| Is SMTP configured? | **NO** | No env vars or email provider config |
| Is auth state persisted? | **YES** | Cookie-based via @supabase/ssr |
| Is there session loss after refresh? | **NO** | getUser() auto-refreshes in middleware |
| Are users stored in auth.users? | **YES** | Supabase managed |
| Is there mismatch between auth.users and profiles? | **PARTIAL** | No profiles table; metadata + org_members |
| Is onboarding broken after signup? | **YES** | No onboarding flow; empty dashboard |
| Can users login after registration? | **YES (after confirmation)** | Standard Supabase flow |

---

## SEVERITY DEFINITIONS

- **P0 (Blocker)**: Prevents core functionality; users cannot complete critical flows
- **P1 (Major)**: Significantly impacts user experience or business goals
- **P2 (Moderate)**: Causes friction or confusion; workaround exists
- **P3 (Minor)**: Polish issue; does not block usage

---

## AUTH SCORE

| Category | Score | Notes |
|----------|-------|-------|
| Registration | 6/10 | Works but lacks validation, CAPTCHA, strength meter |
| Login | 5/10 | Works but no remember me, no rate limiting |
| Password Reset | 0/10 | **COMPLETELY MISSING** |
| Session Management | 8/10 | Good SSR implementation |
| Email Verification | 5/10 | Enabled but no resend, no SMTP config |
| Onboarding | 1/10 | Auto-org creation only; zero guidance |
| **OVERALL** | **4/10** | Core auth works; critical gaps in password reset and onboarding |

---

*Document generated by SALAMANDRA-CTO forensic audit*
*Date: 2026-06-02*
