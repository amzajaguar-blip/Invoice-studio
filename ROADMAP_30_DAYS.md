# ROADMAP 30 DAYS — InvoiceStudio

> **Analyst:** LEVIATAN — Principal SaaS Architect
> **Date:** 2026-06-02
> **Constraint:** 30 development days maximum
> **Optimization target:** Revenue probability × Activation rate × Trust score

---

## RANKING PRINCIPLE

Every task is ranked by:

```
ROI = (Revenue Impact × Trust Impact × Activation Impact) / Development Days
```

Not by technical elegance. Not by architectural purity. By commercial outcome.

---

## WEEK 1: UNBLOCK (Days 1-5)

### Day 1-2: Fix Invoice Creation Flow
**Effort:** 2 days
**ROI:** Highest in entire product

| Action | File | Time |
|--------|------|------|
| Add "+ Nuova Fattura" button to InvoicesView | `InvoicesView.tsx` | 2 hours |
| Wire button to open InvoiceForm modal | `InvoicesView.tsx` | 2 hours |
| Add "Nuova Fattura" modal trigger from DashboardView | `DashboardView.tsx` | 3 hours |
| Test full flow: dashboard → modal → create → list | Manual | 3 hours |
| Allow client creation inline in InvoiceForm | `InvoiceForm.tsx` | 6 hours |

**Why this first:** Nothing else matters if users can't create invoices. This is the single point of failure for the entire product.

### Day 3: Add Password Reset
**Effort:** 1 day
**ROI:** Prevents permanent user loss

| Action | File | Time |
|--------|------|------|
| Create `/forgot-password` page | New file | 3 hours |
| Create `/reset-password` page | New file | 2 hours |
| Add "Password dimenticata?" link to login | `login/page.tsx` | 30 min |
| Wire Supabase `resetPasswordForEmail` | New files | 2 hours |

**Why this day:** Every day without password reset, users who forget passwords are lost forever.

### Day 4: Verify and Fix Auth Callback
**Effort:** 1 day
**ROI:** Unblocks email verification

| Action | File | Time |
|--------|------|------|
| Verify if `/auth/callback` route exists at runtime | Investigation | 1 hour |
| Create route handler if missing | New file | 3 hours |
| Test email confirmation flow end-to-end | Manual | 2 hours |
| Add "Resend confirmation" option to login | `login/page.tsx` | 2 hours |

**Why this day:** If email verification is broken, users can't complete signup.

### Day 5: Fix Stripe Payment Calculation + Tax Rate Bug
**Effort:** 1 day
**ROI:** Makes payments legally correct

| Action | File | Time |
|--------|------|------|
| Remove ritenuta d'acconto from Stripe Checkout | `generate-payment-link/route.ts` | 2 hours |
| Client pays subtotal + IVA only | `generate-payment-link/route.ts` | 1 hour |
| Fix `limit: 1` → `limit: 100` in tax rate lookup | `generate-payment-link/route.ts` | 5 min |
| Apply tax rates to public pay page sessions | `pay/[token]/route.ts` | 2 hours |
| Test payment amounts end-to-end | Manual | 2 hours |

**Why this day:** Wrong payment amounts = legal liability + lost revenue for freelancers.

---

## WEEK 2: POLISH (Days 6-10)

### Day 6: Replace Emoji Icons + Fix Auth Forms
**Effort:** 1 day
**ROI:** Instant professionalism boost

| Action | File | Time |
|--------|------|------|
| Install lucide-react | Terminal | 5 min |
| Replace all emoji nav icons with Lucide | `layout.tsx` | 2 hours |
| Improve auth form card contrast | `signup/page.tsx`, `login/page.tsx` | 2 hours |
| Add password strength meter (zxcvbn) | `signup/page.tsx` | 2 hours |
| Add confirm password field | `signup/page.tsx` | 1 hour |

**Why this day:** Emoji icons are the most visible signal of "hobby project." Fixing this is the highest trust-per-effort action available.

### Day 7: Build Toast Notification System
**Effort:** 1 day
**ROI:** Replaces `alert()` everywhere

| Action | File | Time |
|--------|------|------|
| Create ToastProvider + useToast hook | New files | 3 hours |
| Create Toast component (success/error/info) | New file | 2 hours |
| Replace all `alert()` calls with toast | Multiple files | 2 hours |
| Add success toasts after save/send/delete | Multiple files | 1 hour |

**Why this day:** `alert()` is the #1 signal of prototype. Toast system enables professional feedback everywhere.

### Day 8: Add Google OAuth
**Effort:** 1 day
**ROI:** 20-40% signup conversion increase

| Action | File | Time |
|--------|------|------|
| Configure Google OAuth in Supabase | Dashboard | 30 min |
| Add "Continua con Google" button | `signup/page.tsx`, `login/page.tsx` | 3 hours |
| Handle OAuth redirect + session creation | Auth callback | 2 hours |
| Test Google signup + login flow | Manual | 2 hours |

**Why this day:** Single biggest conversion lever. Every password not created is friction eliminated.

### Day 9: Add GDPR Signup Compliance
**Effort:** 0.5 days
**ROI:** Legal risk mitigation

| Action | File | Time |
|--------|------|------|
| Add terms/privacy checkbox to signup | `signup/page.tsx` | 1 hour |
| Link to privacy policy and terms pages | `signup/page.tsx` | 30 min |
| Translate all Supabase error messages to Italian | `signup/page.tsx` | 2 hours |

**Why this day:** GDPR fines are up to €20M. A checkbox costs 1 hour.

### Day 10: Remove Broken/Fake Elements
**Effort:** 0.5 days
**ROI:** Trust recovery

| Action | File | Time |
|--------|------|------|
| Remove "coming soon" settings tabs | `SettingsView.tsx` | 30 min |
| Remove PromoCard from 0-invoice dashboard | `DashboardView.tsx` | 30 min |
| Remove ReferralBanner | `layout.tsx` | 15 min |
| Remove AI components | `components/ai/` | 15 min |
| Remove rewarded ad web components | `components/rewards/` | 15 min |

**Why this day:** Every removed broken element is trust recovered.

---

## WEEK 3: ONBOARDING (Days 11-15)

### Day 11-12: Build Onboarding Flow
**Effort:** 2 days
**ROI:** Converts signups → activated users

| Action | File | Time |
|--------|------|------|
| Create getting-started checklist component | New file | 3 hours |
| Steps: Add client → Create invoice → Send → Get paid | New file | 1 hour |
| Show checklist on dashboard when 0 invoices | `DashboardView.tsx` | 2 hours |
| Auto-check steps as user completes them | New file | 2 hours |
| Add "Crea prima fattura" prominent CTA | `DashboardView.tsx` | 1 hour |
| Create sample/demo invoice for first-time users | New file | 3 hours |

**Why these days:** Users who don't reach "aha moment" within 5 minutes churn. Onboarding is the bridge.

### Day 13: Add Invoice Preview + Send Confirmation
**Effort:** 1 day
**ROI:** Professionalism + error prevention

| Action | File | Time |
|--------|------|------|
| Add PDF preview tab in InvoiceForm | `InvoiceForm.tsx` | 3 hours |
| Add "Anteprima email" before send | `InvoiceDetailPanel.tsx` | 2 hours |
| Add "Conferma invio" dialog | `InvoiceDetailPanel.tsx` | 1 hour |
| Combine payment link + email into one action | `InvoiceDetailPanel.tsx` | 2 hours |

**Why this day:** Sending without preview is the #1 cause of "I sent the wrong invoice" support requests.

### Day 14: Add Client Import (CSV)
**Effort:** 1 day
**ROI:** Removes activation friction for users with existing clients

| Action | File | Time |
|--------|------|------|
| Create CSV upload + parse component | New file | 3 hours |
| Map CSV columns to client fields | New file | 2 hours |
| Bulk insert with validation | API route | 2 hours |
| Show import results (success/errors) | New file | 1 hour |

**Why this day:** Users with 50+ clients will not enter them one at a time. Import = activation.

### Day 15: Add Search + Pagination to Invoices
**Effort:** 1 day
**ROI:** Usability for users with >10 invoices

| Action | File | Time |
|--------|------|------|
| Add search bar to InvoicesView | `InvoicesView.tsx` | 2 hours |
| Wire to API search parameter | `InvoicesView.tsx` | 1 hour |
| Add pagination controls | `InvoicesView.tsx` | 3 hours |
| Show "X of Y invoices" count | `InvoicesView.tsx` | 1 hour |

**Why this day:** List without search/pagination is unusable beyond 10 items.

---

## WEEK 4: STICKINESS (Days 16-20)

### Day 16-18: Build Fattura Elettronica (XML)
**Effort:** 3 days
**ROI:** Unlocks entire Italian B2B market

| Action | File | Time |
|--------|------|------|
| Research FatturaPA XML schema | Research | 3 hours |
| Build XML generator (FatturaPA format) | New file | 8 hours |
| Add digital signature (XAdES-BES) | New file | 4 hours |
| Add "Scarica Fattura Elettronica (XML)" button | `InvoiceDetailPanel.tsx` | 1 hour |
| Test with Agenzia delle Entrate validation | Manual | 2 hours |

**Why these days:** Without this, the product is legally insufficient for B2B in Italy. This is not optional.

### Day 19-20: Add Recurring Invoices
**Effort:** 2 days
**ROI:** Creates sticky, recurring usage

| Action | File | Time |
|--------|------|------|
| Add recurring schedule to invoice form | `InvoiceForm.tsx` | 3 hours |
| Create cron job for recurring generation | New API route | 4 hours |
| Add "Fatture ricorrenti" section to dashboard | `DashboardView.tsx` | 2 hours |
| Send notification when recurring invoice created | Email template | 2 hours |

**Why these days:** Users with recurring invoices never churn. This is the #1 retention feature.

---

## WEEK 5: AUTOMATION (Days 21-25)

### Day 21-22: Build Email Reminder Sequences
**Effort:** 2 days
**ROI:** "Set and forget" value proposition

| Action | File | Time |
|--------|------|------|
| Create reminder sequence config | New settings UI | 3 hours |
| Default: 7 days before, on due date, 7 days after, 14 days after | Config | 1 hour |
| Build reminder cron job | New API route | 3 hours |
| Add reminder status to invoice detail | `InvoiceDetailPanel.tsx` | 1 hour |
| Allow manual "Invia sollecito" button | `InvoiceDetailPanel.tsx` | 1 hour |

**Why these days:** Automated follow-up is the #1 reason freelancers switch from manual invoicing.

### Day 23: Add Invoice Templates
**Effort:** 1 day
**ROI:** Professional appearance + customization

| Action | File | Time |
|--------|------|------|
| Create 3 PDF templates (Classic, Modern, Minimal) | `InvoicePDF.tsx` | 4 hours |
| Add template selector to InvoiceForm | `InvoiceForm.tsx` | 2 hours |
| Add org logo upload to settings | `SettingsView.tsx` | 2 hours |

**Why this day:** Branded invoices are a top-3 feature request. Templates enable this.

### Day 24: Add Export Formats (PDF Batch, Excel)
**Effort:** 1 day
**ROI:** Accountant compatibility

| Action | File | Time |
|--------|------|------|
| Add PDF batch export (selected invoices) | New API route | 3 hours |
| Add Excel export (XLSX format) | New API route | 2 hours |
| Add export buttons to invoice list | `InvoicesView.tsx` | 2 hours |

**Why this day:** CSV-only export is insufficient for accountants. Excel + PDF batch = professional.

### Day 25: Add Invoice Duplicate + Status Management
**Effort:** 1 day
**ROI:** Workflow efficiency

| Action | File | Time |
|--------|------|------|
| Add "Duplica fattura" action | `InvoicesView.tsx` | 2 hours |
| Add "Segna come pagata" from detail panel | `InvoiceDetailPanel.tsx` | 2 hours |
| Add "Annulla fattura" with confirmation | `InvoiceDetailPanel.tsx` | 2 hours |
| Update invoice status in real-time | State hook | 2 hours |

**Why this day:** Users need to manage invoice lifecycle, not just create.

---

## WEEK 6: LAUNCH PREP (Days 26-30)

### Day 26: Rewrite Landing Page
**Effort:** 1 day
**ROI:** Aligns marketing with product reality

| Action | File | Time |
|--------|------|------|
| Remove all fake features | `page.tsx` | 1 hour |
| Lead with OCR → Invoice → Paid | `page.tsx` | 2 hours |
| Replace fake dashboard with real OCR demo | `page.tsx` | 3 hours |
| Single CTA: "Prova gratis — 3 fatture" | `page.tsx` | 30 min |
| Remove fake social proof | `page.tsx` | 15 min |

**Why this day:** Landing page must match product before launch.

### Day 27: Create Security Page + Status Page
**Effort:** 1 day
**ROI:** Trust signals for paying users

| Action | File | Time |
|--------|------|------|
| Create `/security` page | New file | 3 hours |
| Create status page (or use statuspage.io) | New file | 2 hours |
| Add security info: encryption, RLS, Stripe PCI | New file | 2 hours |
| Link from footer | `page.tsx` | 15 min |

**Why this day:** Paying users check security before entering payment info.

### Day 28: Add Quota Display + Upgrade Flow
**Effort:** 1 day
**ROI:** Monetization path

| Action | File | Time |
|--------|------|------|
| Add "X di 5 fatture utilizzate" to sidebar | `layout.tsx` | 2 hours |
| Show quota progress bar | `layout.tsx` | 1 hour |
| Add upgrade button when quota low | `layout.tsx` | 1 hour |
| Create simple billing page | `SettingsView.tsx` | 3 hours |
| Wire Stripe subscription checkout | New API route | 2 hours |

**Why this day:** Users need to see value before paying. Quota display shows what they're getting.

### Day 29: End-to-End Testing + Bug Fixes
**Effort:** 1 day
**ROI:** Launch reliability

| Action | Time |
|--------|------|
| Test signup → OCR → invoice → send → payment | 3 hours |
| Test password reset flow | 1 hour |
| Test Google OAuth flow | 1 hour |
| Test recurring invoice generation | 1 hour |
| Test Fattura Elettronica XML validation | 1 hour |
| Fix critical bugs found | 2 hours |

### Day 30: Soft Launch
**Effort:** 1 day
**ROI:** First real users

| Action | Time |
|--------|------|
| Deploy to production | 2 hours |
| Monitor error logs | Ongoing |
| Invite 10 beta testers | 1 hour |
| Collect first feedback | Ongoing |
| Write launch announcement | 2 hours |

---

## ROADMAP SUMMARY

| Week | Theme | Days | Key Outcomes |
|------|-------|------|-------------|
| 1 | **Unblock** | 1-5 | Users CAN create and send invoices |
| 2 | **Polish** | 6-10 | Product looks and feels professional |
| 3 | **Onboarding** | 11-15 | New users reach "aha moment" in <5 min |
| 4 | **Stickiness** | 16-20 | Fattura Elettronica + recurring invoices |
| 5 | **Automation** | 21-25 | Reminders, templates, exports |
| 6 | **Launch** | 26-30 | Landing page, trust pages, soft launch |

### What is NOT in this roadmap:

- AI features (Cashflow Predictor, AI suggestions)
- E-Sign / digital signature
- Client portal
- Multi-user / team management
- White-label / custom domain
- QuickBooks / Xero sync
- API + webhooks
- Mobile app improvements

**These are V24-V25 features. They require the core product to work first.**

---

## SUCCESS METRICS (Day 30 Target)

| Metric | Current | Target |
|--------|---------|--------|
| Invoice creation possible | ❌ | ✅ |
| Time to first invoice | ∞ | <5 minutes |
| Password reset exists | ❌ | ✅ |
| Google OAuth exists | ❌ | ✅ |
| Fattura Elettronica exists | ❌ | ✅ |
| Recurring invoices exist | ❌ | ✅ |
| Landing page honest | ❌ | ✅ |
| Professional error handling | ❌ (alert) | ✅ (toast) |
| Professional icons | ❌ (emoji) | ✅ (Lucide) |
| Onboarding flow | ❌ | ✅ |
| Quota display | ❌ | ✅ |
| Trust pages (security/status) | ❌ | ✅ |

**After 30 days: Product is ready for €5/month paid launch with 3-invoice free trial.**
