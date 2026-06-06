# TOP 20 FIXES — Ranked by Impact / Effort

## Scoring
- **Impact**: 1-10 (tester success, activation, trust, revenue)
- **Effort**: 1-10 (hours of work, 1 = 30min, 10 = full day)
- **Priority**: Impact / Effort ratio (higher = do first)

---

## RANK 1: Replace All Emoji Icons with Lucide
**Impact: 9 | Effort: 2 | Priority: 4.5**
- Sidebar: `📊📄👥📈⚙️🚪` → `LayoutDashboard, FileText, Settings, LogOut`
- Dashboard KPI: `💰📄⏳⚠️👥` → `Wallet, FileText, Clock, AlertTriangle, Users`
- InvoiceForm: `✦✕✨⏳` → remove or replace
- InvoiceDetailPanel: `📄📋🔗📤🔔✓` → `FileText, ClipboardCopy, Link, Send, Bell, Check`
- Landing trust bar: all emojis → text or Lucide
**Files**: `layout.tsx`, `DashboardView.tsx`, `InvoiceForm.tsx`, `InvoiceDetailPanel.tsx`, `page.tsx`
**Time**: 2 hours

---

## RANK 2: Build PDF Export
**Impact: 10 | Effort: 6 | Priority: 1.7**
- Use `@react-pdf/renderer` (already in package.json)
- Create Italian invoice PDF template
- Include business info from settings
- Add Download button to InvoiceDetailPanel
- Add `@media print` CSS
**Files**: New `PdfInvoice.tsx`, modify `InvoiceDetailPanel.tsx`, add API route
**Time**: 6 hours

---

## RANK 3: Add Password Reset Flow
**Impact: 10 | Effort: 4 | Priority: 2.5**
- "Password dimenticata?" link on login
- `/forgot-password` page
- `/auth/reset-password` page
- Wire Supabase `resetPasswordForEmail` + `updateUser`
**Files**: `login/page.tsx`, new `forgot-password/page.tsx`, new `auth/reset-password/page.tsx`
**Time**: 4 hours

---

## RANK 4: Redirect New Users to Scanner (Not Dashboard)
**Impact: 9 | Effort: 1 | Priority: 9.0**
- Change middleware redirect after login
- Add `/scanner` to auth callback allowed redirects
- Remove revenue chart from dashboard
- Remove referral banner
**Files**: `middleware.ts`, `auth/callback/route.ts`, `DashboardView.tsx`, `layout.tsx`
**Time**: 30 minutes

---

## RANK 5: Remove All Fake Claims from Landing
**Impact: 8 | Effort: 1 | Priority: 8.0**
- Remove Agency plan card
- Remove "2.000 freelancer" social proof
- Remove AI Cashflow, E-Sign, Sync, Portal, API features
- Remove "PCI-DSS Compliant"
- Remove "Prova gratis 14 giorni"
**File**: `page.tsx`
**Time**: 1 hour

---

## RANK 6: Add Real Stripe Checkout
**Impact: 10 | Effort: 5 | Priority: 2.0**
- Create real Checkout Session for €5/month
- Replace `https://buy.stripe.com/your_link`
- Create real Customer Portal link
- Replace `https://billing.stripe.com/p/login/your_portal`
- Wire webhooks for subscription events
**Files**: `SettingsClient.tsx`, new API routes
**Time**: 5 hours

---

## RANK 7: Add Resend Confirmation Email
**Impact: 8 | Effort: 1 | Priority: 8.0**
- Add "Non hai ricevuto l'email? Reinvia" on login page
- Call `supabase.auth.resend({ type: 'signup', email })`
**File**: `login/page.tsx`
**Time**: 30 minutes

---

## RANK 8: Hide Analytics & Clients from Nav
**Impact: 6 | Effort: 1 | Priority: 6.0**
- Remove from `NAV_ITEMS` in layout
- Keep pages functional (just hide nav links)
- Inline client creation inside invoice form is enough
**File**: `layout.tsx`
**Time**: 15 minutes

---

## RANK 9: Fix Notification Toggle Persistence
**Impact: 6 | Effort: 2 | Priority: 3.0**
- Add `notification_settings` JSONB column to organizations
- Create `/api/settings/notifications` PATCH endpoint
- Wire SettingsClient to call API instead of just local state
**Files**: `SettingsClient.tsx`, new API route, DB migration
**Time**: 2 hours

---

## RANK 10: Add Camera Capture to OCR Upload
**Impact: 7 | Effort: 1 | Priority: 7.0**
- Add `capture="environment"` to file input
- Ensures mobile users go directly to camera
**File**: `OcrUploadZone.tsx`
**Time**: 5 minutes

---

## RANK 11: Fix Signup Error Messages
**Impact: 6 | Effort: 1 | Priority: 6.0**
- Add `translateSignupError()` similar to login's `translateAuthError()`
- Map: "User already registered", "Password should be at least 10 characters", etc.
**File**: `signup/page.tsx`
**Time**: 30 minutes

---

## RANK 12: Add Terms Checkbox to Signup
**Impact: 6 | Effort: 1 | Priority: 6.0**
- Add required checkbox with links to /terms and /privacy
- Block submission if unchecked
**File**: `signup/page.tsx`
**Time**: 30 minutes

---

## RANK 13: Fix Auth Callback Error Handling
**Impact: 5 | Effort: 1 | Priority: 5.0**
- On error, redirect to `login?error=confirmation_expired`
- Show error message on login page
**Files**: `auth/callback/route.ts`, `login/page.tsx`
**Time**: 30 minutes

---

## RANK 14: Remove "Coming Soon" Settings Tabs
**Impact: 5 | Effort: 1 | Priority: 5.0**
- Show only: Profile, Plan, Danger Zone
- Remove Notifications tab (until persistence fixed) or fix it
**File**: `SettingsClient.tsx`
**Time**: 15 minutes

---

## RANK 15: Add SMTP Configuration (Resend)
**Impact: 7 | Effort: 2 | Priority: 3.5**
- Configure Resend or Postmark for transactional emails
- Branded sender: "InvoiceStudio <noreply@invoicestudio.it>"
- Ensures confirmation emails arrive (not spam)
**Files**: Environment config, Supabase settings
**Time**: 2 hours

---

## RANK 16: Fix Auto-Generated Org Name Bug
**Impact: 4 | Effort: 1 | Priority: 4.0**
- SQL trigger: `COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utente') || ' Studio'`
**File**: `backend/migration.sql`
**Time**: 15 minutes

---

## RANK 17: Add Search to Invoice List
**Impact: 5 | Effort: 1 | Priority: 5.0**
- API already supports `search` query param
- Add input field to `InvoicesView.tsx`
**File**: `InvoicesView.tsx`
**Time**: 30 minutes

---

## RANK 18: Remove Rewarded Ads from Settings
**Impact: 4 | Effort: 1 | Priority: 4.0**
- Remove credit display from Plan tab
- Remove rewarded ads mention
- Keep backend logic (just hide UI)
**File**: `SettingsClient.tsx`
**Time**: 15 minutes

---

## RANK 19: Add Rate Limiting to Auth
**Impact: 5 | Effort: 2 | Priority: 2.5**
- After 3 failed login/signup attempts, show cooldown message
- Disable button for 60 seconds
**Files**: `login/page.tsx`, `signup/page.tsx`
**Time**: 1 hour

---

## RANK 20: Simplify Dashboard KPIs
**Impact: 4 | Effort: 1 | Priority: 4.0**
- Remove revenue chart (empty for new users)
- Show only: Fatture questo mese | Da incassare
- Replace emoji icons with Lucide
**File**: `DashboardView.tsx`
**Time**: 1 hour

---

## SUMMARY

| Tier | Fixes | Total Time | Impact |
|------|-------|-----------|--------|
| **DO FIRST** (Rank 1-5) | Emoji→Lucide, PDF, Password reset, Redirect to scanner, Honest landing | ~14h | **CRITICAL** |
| **DO SECOND** (Rank 6-10) | Stripe, Resend email, Hide nav, Notifications, Camera capture | ~11h | **HIGH** |
| **DO THIRD** (Rank 11-15) | Signup errors, Terms, Callback error, Settings tabs, SMTP | ~5h | **MEDIUM** |
| **DO IF TIME** (Rank 16-20) | Org name, Search, Remove ads, Rate limiting, Simplify KPIs | ~4h | **POLISH** |

**Total realistic effort: ~34 hours = 4-5 days of focused work**

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
