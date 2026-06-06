# InvoiceStudio — Architecture Map

## Document Purpose
Forensic mapping of the InvoiceStudio application architecture with actual code references.

---

## 1. Folder Structure

```
invoice-studio/
├── frontend/              # Next.js 16 App Router (web app)
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   │   ├── (auth)/     # Auth route group
│   │   │   ├── (dashboard)/ # Dashboard route group
│   │   │   ├── api/        # API routes (Next.js)
│   │   │   ├── auth/       # Auth callbacks
│   │   │   ├── pay/        # Payment page
│   │   │   ├── privacy/    # Privacy policy
│   │   │   └── terms/      # Terms of service
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Theme)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   ├── repositories/   # Data access layer
│   │   ├── styles/         # Global styles
│   │   └── types/          # TypeScript types
│   ├── public/            # Static assets
│   └── tests/             # Playwright e2e tests
├── mobile/                # React Native (Expo) app
│   ├── app/               # Expo Router
│   ├── components/        # Mobile components
│   ├── lib/               # Mobile utilities
│   └── shared/            # Shared code with web
├── backend/               # SQL migrations & scripts
│   └── *.sql              # Supabase migrations
└── supabase/              # Supabase config
    └── migrations/         # Migration files
```

---

## 2. Frontend Architecture

### Stack
- **Framework**: Next.js 16.2.6 with App Router
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 4.3.0 + CSS variables (dark theme)
- **Auth**: Supabase SSR (@supabase/ssr 0.10.3)
- **State**: React hooks + localStorage (no global state library)
- **Forms**: react-hook-form 7.76.0 + Zod 4.4.3
- **PDF**: @react-pdf/renderer 4.5.1
- **OCR**: tesseract.js 5.1.1 (client-side)
- **Payment**: Stripe 22.1.1
- **Email**: Resend 6.12.3 + @react-email/components
- **Monitoring**: Sentry 8.20.0
- **Testing**: Playwright 1.60.0

### Architecture Pattern
The frontend uses a **Repository + Hook State** pattern:

```
Component → useXxxState Hook → Repository → Supabase Client
```

Example:
- `DashboardView.tsx` → `useDashboardState.ts` → `dashboard-repository.supabase.ts` → `createClient()`

### Key Code References
- **Client-side Supabase**: `@/frontend/src/lib/supabase/client.ts`
- **Server-side Supabase**: `@/frontend/src/lib/supabase/server.ts`
- **Auth helper**: `@/frontend/src/lib/supabase/auth-helper.ts`
- **Middleware**: `@/frontend/src/middleware.ts`
- **Theme context**: `@/frontend/src/contexts/ThemeContext`
- **UI states**: `@/frontend/src/components/ui-states/index.tsx`

---

## 3. Backend Architecture

### Stack
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth (GoTrue)
- **Storage**: Supabase Storage (logos, pdfs)
- **Edge Functions**: Not used (API routes in Next.js)
- **RLS**: Row Level Security policies on all tables

### API Routes (Next.js)
Located in `@/frontend/src/app/api/`:
- `/api/invoices` — CRUD invoices
- `/api/ocr/receipt` — OCR processing
- `/api/webhooks/stripe` — Stripe webhooks
- `/api/profile` — User profile
- `/api/clients` — Client management
- `/api/invoices/[id]/send-email` — Email sending
- `/api/invoices/[id]/generate-payment-link` — Stripe payment links
- `/api/rewards` — Rewarded ads credit system

### Key Code References
- **Invoice API**: `@/frontend/src/app/api/invoices/route.ts`
- **OCR API**: `@/frontend/src/app/api/ocr/receipt/route.ts`
- **Stripe Webhook**: `@/frontend/src/app/api/webhooks/stripe/route.ts`
- **Plan logic**: `@/frontend/src/lib/plan.ts`
- **Rate limiting**: `@/frontend/src/lib/rate-limit.ts`
- **Audit logging**: `@/frontend/src/lib/audit.ts`

---

## 4. Auth Flow

```
User
↓
[Signup Page]  →  supabase.auth.signUp()  →  auth.users table
@/frontend/src/app/(auth)/signup/page.tsx
↓
[Email Confirmation]  →  Supabase sends confirmation email
↓
[Login Page]  →  supabase.auth.signInWithPassword()
@/frontend/src/app/(auth)/login/page.tsx
↓
[Middleware]  →  getUser() validates JWT + refresh tokens
@/frontend/src/middleware.ts
↓
[Dashboard]  →  org_members lookup → organization
@/frontend/src/app/(dashboard)/layout.tsx
```

### Auth Implementation Details
- **Registration**: Email + password with `full_name` metadata
- **Email confirmation**: Enabled (redirects to `/auth/callback`)
- **Session**: Cookie-based via `@supabase/ssr`
- **Middleware**: Validates on every request, redirects unauthenticated users
- **Auto-org creation**: Trigger `handle_new_user()` creates org on signup
- **Logout**: `supabase.auth.signOut()` → redirect to `/login`

### Code References
- Signup: `@/frontend/src/app/(auth)/signup/page.tsx:25-32`
- Login: `@/frontend/src/app/(auth)/login/page.tsx:48-60`
- Middleware: `@/frontend/src/middleware.ts:19-82`
- Auth helper: `@/frontend/src/lib/supabase/auth-helper.ts:35-105`
- Auto-org trigger: `@/backend/migration.sql:407-431`

---

## 5. Database Schema

### Core Tables
```sql
auth.users              — Supabase auth (managed)
public.organizations    — Company/workspace data
public.org_members      — User-org membership (roles: owner, admin, member)
public.clients          — Customer database
public.invoices         — Invoice headers
public.invoice_items    — Invoice line items
public.invoice_events   — Audit trail (created, sent, paid, etc.)
```

### Supporting Tables
```sql
public.email_templates      — Email templates per org
public.reminders            — Scheduled reminders
public.payment_tokens       — Secure payment links
public.subscriptions        — Stripe subscription data
public.audit_logs           — GDPR compliance audit trail
public.org_credits          — Rewarded ad credits wallet
public.credit_transactions  — Credit ledger
public.ad_impressions       — Ad view tracking
public.invoice_ocr_jobs     — OCR job queue
public.invoice_ocr_results  — OCR extracted data
```

### RLS Policy Model
All tables have RLS enabled with `current_org_id()` function:
```sql
CREATE FUNCTION current_org_id() RETURNS uuid
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
```

### Code References
- Full migration: `@/backend/migration.sql`
- Database types: `@/frontend/src/types/database.ts`
- OCR migration: `@/backend/migration_ocr.sql`

---

## 6. Supabase Configuration

### Auth Settings (inferred from code)
- **Email confirmation**: Enabled (`emailRedirectTo` configured)
- **SMTP**: Not configured in code (uses Supabase default)
- **Session**: Persistent via cookies
- **Refresh tokens**: Handled by `@supabase/ssr` auto-refresh

### Storage Buckets (configured but not created in migration)
- `logos` — Public, 10MB, image types
- `pdfs` — Private, 25MB, PDF only

### Code References
- Client config: `@/frontend/src/lib/supabase/client.ts`
- Server config: `@/frontend/src/lib/supabase/server.ts`
- Admin client: `@/frontend/src/lib/supabase/admin.ts`

---

## 7. Onboarding Flow

```
Landing Page (/)
↓
"Inizia gratis" → Signup (/signup)
↓
Form: Name, Email, Password (min 10 chars)
↓
supabase.auth.signUp() → auth.users + trigger → organizations + org_members
↓
Redirect to /login?signup=success
↓
"Account creato! Controlla email per verificarlo"
↓
User clicks email confirmation link
↓
/auth/callback → /dashboard
```

### Onboarding Issues
- **No guided onboarding** after first login
- **No tutorial** for invoice creation
- **No sample data** injected for new users
- **No profile completion** prompt
- **Empty dashboard** on first login (no invoices = no data)

### Code References
- Landing: `@/frontend/src/app/page.tsx:9-21`
- Signup: `@/frontend/src/app/(auth)/signup/page.tsx:19-42`
- Dashboard empty state: `@/frontend/src/app/(dashboard)/dashboard/DashboardView.tsx:88-103`

---

## 8. Invoice Creation Flow

```
User clicks "✦ Nuova Fattura"
↓
InvoiceForm modal opens
@/frontend/src/components/invoices/InvoiceForm.tsx
↓
Select client (from clients table)
Add line items (description, qty, price)
Set VAT %, withholding tax %, due date
AI suggestions available (✨ button)
↓
Click "✦ Crea fattura"
↓
POST /api/invoices
@/frontend/src/app/api/invoices/route.ts:75-251
↓
Plan limit check → getUserQuota()
Number generation: INV-{year}-{seq}
Insert invoice + invoice_items
Log invoice_events (created)
Audit log (GDPR)
Consume rewarded credit if applicable
↓
Invoice appears in list
```

### Code References
- Invoice form: `@/frontend/src/components/invoices/InvoiceForm.tsx`
- Invoice API: `@/frontend/src/app/api/invoices/route.ts`
- Invoice list: `@/frontend/src/app/(dashboard)/invoices/InvoicesView.tsx`
- Plan enforcement: `@/frontend/src/lib/plan.ts:93-149`

---

## 9. OCR Flow

```
User clicks "⚡ Importa Documento (OCR)"
↓
ScannerView (/scanner)
@/frontend/src/app/(dashboard)/scanner/ScannerView.tsx
↓
Upload image/PDF
↓
PDF → convert to PNG (pdfjs-dist)
↓
POST /api/ocr/receipt { imageBase64 }
@/frontend/src/app/api/ocr/receipt/route.ts
↓
Tesseract.js OCR (ita + eng)
↓
Parse fields with regex:
  - supplierName, vatNumber, invoiceNumber
  - invoiceDate, taxableAmount, vatAmount, totalAmount
↓
Return confidence scores
↓
OcrReviewForm — user reviews/corrects extracted data
@/frontend/src/components/ocr/OcrReviewForm.tsx
↓
User confirms → save as invoice
```

### Code References
- Scanner page: `@/frontend/src/app/(dashboard)/scanner/page.tsx`
- Scanner view: `@/frontend/src/app/(dashboard)/scanner/ScannerView.tsx`
- OCR API: `@/frontend/src/app/api/ocr/receipt/route.ts`
- OCR upload: `@/frontend/src/components/ocr/OcrUploadZone.tsx`
- OCR review: `@/frontend/src/components/ocr/OcrReviewForm.tsx`

---

## 10. Dashboard Flow

```
User logs in → /dashboard
↓
Server Component: getCurrentUser() + org lookup
@/frontend/src/app/(dashboard)/dashboard/page.tsx
↓
DashboardView (client component)
@/frontend/src/app/(dashboard)/dashboard/DashboardView.tsx
↓
useDashboardState hook fetches:
  - KPIs (revenue, invoices, pending, recovery, clients)
  - Revenue trend (last 6 months)
↓
UiStateRenderer handles loading/error/empty states
↓
Render:
  - KPI cards (grid)
  - Revenue chart (SVG line chart)
  - Welcome card / PromoCard (if 0 invoices)
  - Quick actions
```

### Code References
- Dashboard page: `@/frontend/src/app/(dashboard)/dashboard/page.tsx`
- Dashboard view: `@/frontend/src/app/(dashboard)/dashboard/DashboardView.tsx`
- KPI card: `@/frontend/src/components/dashboard/KPICard.tsx`
- UI states: `@/frontend/src/components/ui-states/index.tsx`

---

## 11. Settings Flow

```
User clicks "Impostazioni" in sidebar
↓
SettingsPage (server) → org lookup
@/frontend/src/app/(dashboard)/settings/page.tsx
↓
SettingsView (client)
@/frontend/src/app/(dashboard)/settings/SettingsView.tsx
↓
Tabs: Profilo, Piano, Notifiche, Zona Pericolosa
↓
Profile: Edit name, org name (read-only email)
Plan: View quota, upgrade CTA (Stripe link)
Notifications: Toggle switches (NOT PERSISTED)
Danger Zone: Account deletion with "ELIMINA" confirmation
```

### Settings Issues
- **Billing section is fake** — SettingsView only shows profile tab, other tabs say "Sezione in arrivo"
- **Notification toggles don't persist** — SettingsClient.tsx has local state only, no API call
- **Stripe links are hardcoded placeholders** — `https://buy.stripe.com/your_link`

### Code References
- Settings page: `@/frontend/src/app/(dashboard)/settings/page.tsx`
- Settings view: `@/frontend/src/app/(dashboard)/settings/SettingsView.tsx`
- Settings client: `@/frontend/src/app/(dashboard)/settings/SettingsClient.tsx`

---

## 12. Data Flow Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│   Browser   │────▶│  Next.js    │
│             │     │  (React)    │     │  API Route  │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                                       │
       │                                       ▼
       │                              ┌─────────────┐
       │                              │  Supabase   │
       │                              │  (Postgres) │
       │                              └──────┬──────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                      ┌─────────────┐
│   Stripe    │◀────────────────────▶│   Auth/RLS  │
│  (Payments) │                      │   (JWT)     │
└─────────────┘                      └─────────────┘
```

---

## 13. Mobile App Architecture

### Stack
- **Framework**: React Native with Expo Router
- **Auth**: Same Supabase auth (Bearer token)
- **Shared logic**: Accounting, OCR, payments, notifications

### Key Files
- Entry: `@/mobile/app/_layout.tsx`
- Login: `@/mobile/app/login.tsx`
- Supabase: `@/mobile/lib/supabase.ts`
- Services: `@/mobile/lib/*.ts` (accounting, ai, cloud-sync, notifications, ocr, payment, pdf, scanner-quota, signature)

---

## 14. Security Architecture

### Measures Implemented
- RLS on all tables
- Rate limiting (30 req/min for invoice creation)
- UUID validation before DB operations (SEC-001)
- Audit logging for GDPR
- Payment audit logs (PCI-DSS compliance)
- HMAC verification for rewarded ads
- Stripe webhook signature verification

### Code References
- Rate limit: `@/frontend/src/lib/rate-limit.ts`
- Audit: `@/frontend/src/lib/audit.ts`
- Payment audit: `@/frontend/src/lib/payment-audit.ts`
- RLS policies: `@/backend/migration.sql:59-182`

---

*Document generated by SALAMANDRA-CTO forensic audit*
*Date: 2026-06-02*
