# KILL LIST — InvoiceStudio

> **Analyst:** LEVIATAN — Principal SaaS Architect
> **Date:** 2026-06-02
> **Principle:** Every feature that doesn't drive revenue, retention, trust, or activation is dead weight.

---

## DECISION FRAMEWORK

| Verdict | Criteria |
|---------|----------|
| **KEEP** | Directly drives revenue, retention, trust, or activation. Already working. |
| **IMPROVE** | Valuable but broken, incomplete, or poorly executed. |
| **REMOVE** | Adds complexity without value. Distracts from core. Creates false expectations. |

---

## SCREENS & PAGES

### Landing Page (`/`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| Hero section | **REWRITE** | Lead with OCR, not "Premium SaaS" |
| Fake dashboard preview | **REMOVE** | Sets wrong expectations. Replace with real OCR demo. |
| 8 feature cards | **REDUCE to 3** | Keep: OCR Scanner, Pagamento 1-click, Fattura Elettronica. Remove: E-Sign, AI, Client Portal, QuickBooks, White-label. |
| "2.000 freelancer italiani" | **REMOVE** | Unverifiable claim. Replace when you have real numbers. |
| TrustBar badges | **REDUCE** | Keep: Stripe, PCI-DSS (if real). Remove: "AI Cashflow", "Firma Digitale" |
| Pricing section | **REMOVE** | Replace with single CTA: "€5/month. 3 invoices free." |
| HowItWorks section | **REWRITE** | Show real OCR flow: Photo → Scan → Invoice → Paid |

### Signup Page (`/signup`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| Dark-on-dark card | **IMPROVE** | Add visible card border or light background |
| Password field (no strength) | **IMPROVE** | Add zxcvbn strength meter |
| No confirm password | **IMPROVE** | Add confirmation field |
| No terms checkbox | **IMPROVE** | Add GDPR consent checkbox |
| Raw error messages | **IMPROVE** | Translate all Supabase errors to Italian |
| "Crea account" button | **KEEP** | Works |

### Login Page (`/login`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| No "Forgot password?" | **IMPROVE** | Add password reset link + flow |
| Hard redirect flash | **IMPROVE** | Use router.push with proper cookie handling |
| Suspense skeleton | **KEEP** | Good UX |
| Italian error translations | **KEEP** | Good |

### Dashboard (`/dashboard`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| "Nuova Fattura" as `<a>` link | **IMPROVE** | Change to button that opens InvoiceForm modal |
| KPI cards | **KEEP** | Functional, useful |
| Revenue chart | **KEEP** | Good visual |
| PromoCard at 0 invoices | **REMOVE** | Shows upgrade pitch before user experiences value. Replace with onboarding checklist. |
| Quick actions | **KEEP** | Useful navigation |

### Invoices Page (`/invoices`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| Missing "+ Nuova" button | **IMPROVE** | Add back — this is the P0 blocker |
| `alert()` error handling | **IMPROVE** | Replace with toast notifications |
| Filter bar | **KEEP** | Works |
| No pagination | **IMPROVE** | Add pagination controls |
| No search bar | **IMPROVE** | Add search (API already supports it) |

### Clients Page (`/clients`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| Dead "Nuovo Cliente" button | **IMPROVE** | Wire up ClientForm modal |
| No CSV import | **IMPROVE** | Add client import |

### Scanner Page (`/scanner`)
**Verdict: KEEP**

| Element | Action | Why |
|---------|--------|-----|
| Multi-step workflow | **KEEP** | Best UX in the app |
| OcrUploadZone | **KEEP** | Works |
| OcrReviewForm | **KEEP** | Works |
| PDF conversion step | **KEEP** | Works |
| Success state | **KEEP** | Works |

### Settings Page (`/settings`)
**Verdict: IMPROVE**

| Element | Action | Why |
|---------|--------|-----|
| 3 "coming soon" tabs | **REMOVE** | Don't show tabs that don't work. Only show Profile tab. |
| Hardcoded withholding tax | **IMPROVE** | Read from org settings, allow edit |
| No save confirmation | **IMPROVE** | Add success toast |

### Analytics Page (`/analytics`)
**Verdict: REMOVE from nav, keep page**

| Element | Action | Why |
|---------|--------|-----|
| Analytics nav item | **REMOVE** | Dashboard already shows KPIs. Separate analytics page adds confusion. |
| Analytics page | **KEEP (hidden)** | Keep for future, remove from navigation until it has unique value. |

---

## COMPONENTS

### KEEP

| Component | Why |
|-----------|-----|
| `UiStateRenderer` | Core architecture pattern. Forces handling of all states. |
| `InvoiceForm` | Core value. Needs to be accessible from dashboard + invoices page. |
| `InvoiceDetailPanel` | Essential for viewing/sending invoices. |
| `StatusBadge` | Clean, useful. |
| `KPICard` | Good dashboard component. |
| `OcrUploadZone` | Core differentiator. |
| `OcrReviewForm` | Core differentiator. |
| `ScannerView` | Best screen in the app. |
| `ThemeProvider` | Required for dark/light mode. |

### IMPROVE

| Component | What to Improve |
|-----------|----------------|
| `InvoiceForm` | Add client creation inline. Add PDF preview. Add template selection. |
| `InvoiceDetailPanel` | Add status change actions. Add resend option. |
| `DashboardView` | Replace PromoCard with onboarding checklist. Add "Nuova Fattura" modal trigger. |
| `InvoicesView` | Add create button. Add search. Add pagination. Replace `alert()`. |
| `ClientsView` | Wire up create button. Add import. |
| `SettingsView` | Remove non-functional tabs. Add proper form handling. |

### REMOVE

| Component | Why |
|-----------|-----|
| `PromoCard` | Shows upgrade pitch to users who haven't experienced value. Damages trust. |
| `ReferralBanner` | Always visible. Clutter. Low conversion. Remove until referral program exists. |
| `AIChatBox` | AI features don't exist. Placeholder component. Remove until AI is real. |
| `HardLimitModal` | Replace with inline quota display. Modal is aggressive. |
| `LimitWarningBanner` | Replace with persistent quota indicator in sidebar. |
| `RewardedAdModal` | Rewarded ads are a mobile feature. Remove from web until web ad integration exists. |
| `ShareInvoice` | Keep component but remove from default flow. Add as optional action after send. |

---

## CODE AREAS

### KEEP

| Area | Why |
|------|-----|
| `lib/supabase/` | Auth infrastructure. Works. |
| `lib/plan.ts` | Quota enforcement. Works. |
| `lib/stripe/` | Payment integration. Works (minus ritenuta bug). |
| `lib/email/resend.ts` | Email delivery. Works. |
| `lib/pdf/InvoicePDF.tsx` | PDF generation. Works. |
| `middleware.ts` | Auth gate. Works. |
| `types/` | Type system. Well-structured. |
| `hooks/state/` | State management pattern. Good architecture. |
| `repositories/` | Data access layer. Good architecture. |

### IMPROVE

| Area | What to Improve |
|------|----------------|
| `api/invoices/[id]/generate-payment-link/route.ts` | Fix ritenuta d'acconto. Fix tax rate pagination. |
| `api/ocr/receipt/route.ts` | Add progress reporting. Improve error messages. |
| `lib/rate-limit.ts` | Replace in-memory with Redis or DB-backed. |
| `globals.css` | Add light mode. Reduce animation count. |

### REMOVE

| Area | Why |
|------|-----|
| `InvoiceStudio.jsx` (35,701 lines) | Legacy monolith. Dead code. Remove from repo entirely. |
| `components/ai/` | AI features don't exist. Placeholder code. |
| `components/promotion/` (except ShareInvoice) | Premature growth features. Build product first. |
| `components/rewards/` (web-specific) | Rewarded ads are mobile-only. Remove web components. |
| `backend/` directory | Raw SQL files. Migrate to Supabase migrations or remove. |

---

## FLOWS

### KEEP

| Flow | Why |
|------|-----|
| Signup → Org creation (trigger) | Works. Atomic. |
| Login → Dashboard | Works. |
| OCR → Review → Create Invoice | Core differentiator. Works. |
| Generate payment link → Stripe Checkout | Works (minus ritenuta bug). |
| Send email → Resend delivery | Works. |

### IMPROVE

| Flow | What to Improve |
|------|----------------|
| Dashboard → Create Invoice | Currently navigates away. Should open modal. |
| Create Invoice → Send | Add preview step. Add confirmation dialog. |
| Invoice List → Detail | Add click-to-open detail panel. |

### REMOVE

| Flow | Why |
|------|-----|
| Rewarded ad → Credit → Invoice | Mobile-only flow. Remove from web until web ads exist. |
| Upgrade prompt (PromoCard) | Shows before value delivery. Remove. |

---

## SUMMARY

| Verdict | Count |
|---------|-------|
| **KEEP** | 24 items |
| **IMPROVE** | 18 items |
| **REMOVE** | 14 items |

### Biggest removals by impact:

1. **Landing page fake features** — Stops lying to users
2. **PromoCard** — Stops annoying new users
3. **InvoiceStudio.jsx** — Removes 35K lines of dead code
4. **Analytics nav item** — Reduces confusion
5. **"Coming soon" settings tabs** — Stops showing broken UI
6. **AI components** — Removes vaporware

### Principle:

**Every removal increases trust. Every removal reduces maintenance. Every removal focuses the product.**

**A product with 10 features that all work is worth more than a product with 50 features where 25 are broken.**
