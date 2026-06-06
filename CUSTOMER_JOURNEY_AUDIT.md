# InvoiceStudio — Customer Journey Audit

## Document Purpose
Step-by-step forensic audit of the complete customer journey, identifying friction, confusion, dead ends, missing feedback, and missing onboarding.

---

## JOURNEY MAP

```
Landing
  ↓
Signup
  ↓
Confirmation
  ↓
Login
  ↓
Dashboard
  ↓
Create Invoice
  ↓
Export
```

---

## STEP 1: LANDING PAGE (/)
**File**: `@/frontend/src/app/page.tsx`

### What Happens
User arrives at InvoiceStudio landing page. Sees hero section with "Fattura. Incassa. Cresci.", fake dashboard preview, feature grid, pricing, and CTA.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 1.1 | **No value proposition clarity** — "Risparmia 5 ore a settimana" is an unverified claim with no calculator or proof | Medium |
| 1.2 | **Fake social proof** — "2.000 freelancer italiani" with no testimonials, logos, or verifiable data | High |
| 1.3 | **Fake dashboard preview** — Static image with made-up numbers. Users who click expecting interactivity are disappointed | Medium |
| 1.4 | **Feature overload without demonstration** — 8 features listed with emoji icons, zero interactive demos or screenshots | Medium |
| 1.5 | **Pricing ambiguity** — Free plan says "5 fatture/mese" but no clear explanation of what happens when limit is reached | Medium |
| 1.6 | **No live demo / try-without-signup** — Forces signup to see product | High |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 1.7 | **"Setup in 2 minuti" claim** — Not validated anywhere; actual setup requires email confirmation which often takes longer | Medium |
| 1.8 | **"Disdici quando vuoi"** — No cancellation policy or process shown before signup | Low |

### Missing Feedback
- No "How it works" video or animated demo
- No calculator to show actual time/money savings
- No FAQ section on landing
- No live chat or support widget

### Missing Onboarding
- No preview of what the dashboard looks like with real data
- No "See how it works for your industry" personalization

---

## STEP 2: SIGNUP (/signup)
**File**: `@/frontend/src/app/(auth)/signup/page.tsx`

### What Happens
User clicks "Inizia gratis" → arrives at signup form with Name, Email, Password fields.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 2.1 | **No plan selection during signup** — User doesn't know which plan they're signing up for | Medium |
| 2.2 | **Password minimum 10 chars** — Good for security but no strength meter, so user doesn't know if password is adequate until submit | Medium |
| 2.3 | **No social login** — Google/Microsoft login not available; increases friction | Medium |
| 2.4 | **No terms/privacy acceptance** — Legal risk; user never explicitly agrees to terms | High |
| 2.5 | **No email validation in real-time** — Must submit to discover email is taken/invalid | Low |
| 2.6 | **No "why we need this" explanations** — Name field has no context (used for org name generation) | Low |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 2.7 | **What happens next?** — No indication that email confirmation is required before using the app | High |
| 2.8 | **"Crea account" button gives no preview** — User can't see what they're getting before committing | Medium |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 2.9 | **No "already have an account?" prominent link** — Small text link at bottom, easy to miss | Low |

### Missing Feedback
- No "Check your email" immediate preview after signup (shows on next page only)
- No progress indicator (step 1 of 3?)
- No email format validation feedback (only HTML5)

### Missing Onboarding
- No "What you'll be able to do" teaser during signup
- No plan comparison before signup
- No onboarding questions (business type, volume, etc.)

---

## STEP 3: EMAIL CONFIRMATION
**Files**: `@/frontend/src/app/(auth)/login/page.tsx`, `@/frontend/src/app/auth/callback/page.tsx`

### What Happens
User receives email from Supabase → clicks link → `/auth/callback?next=/dashboard` → redirected to dashboard.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 3.1 | **Email sender is generic Supabase** — "noreply@supabase.io" or similar, not "InvoiceStudio" — hurts trust and deliverability | High |
| 3.2 | **No email resend option** — If email doesn't arrive or goes to spam, user has no recourse in the UI | High |
| 3.3 | **No "Didn't receive email?" help** — No guidance on checking spam, whitelisting, etc. | Medium |
| 3.4 | **Confirmation link expiration unclear** — No indication of how long the link is valid | Low |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 3.5 | **Login page shows success message but still requires separate login** — After signup, user lands on login page with "Account creato!" banner but must still enter credentials. Confusing: "Didn't I just create an account?" | High |
| 3.6 | **No auto-login after confirmation** — User must manually log in even after clicking email link | Medium |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 3.7 | **Email never arrives → no support path** — No contact form, no chat, no "contact support" link | Critical |
| 3.8 | **Confirmation link clicked twice → cryptic error** — Supabase may show generic error, no friendly "Already confirmed" message | Medium |

### Missing Feedback
- No "Email sent" confirmation with timestamp
- No "Resend in 60 seconds" countdown
- No delivery status tracking

### Missing Onboarding
- No "Welcome to InvoiceStudio" email with next steps
- No "Complete your profile" prompt in confirmation email

---

## STEP 4: LOGIN (/login)
**File**: `@/frontend/src/app/(auth)/login/page.tsx`

### What Happens
User enters email and password → clicks "Accedi" → redirected to dashboard.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 4.1 | **No "Remember me" checkbox** — User must re-login frequently | Medium |
| 4.2 | **Full page reload on login** — Uses `window.location.assign()` instead of router navigation; jarring experience | Low |
| 4.3 | **No password visibility toggle by default** — Must click eye icon | Low |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 4.4 | **"Email not confirmed" error** — If user tries to login before confirming, error appears. But no "Resend confirmation" button alongside the error | High |
| 4.5 | **Redirect parameter** — After login, user goes to `/dashboard` even if they originally tried to access a specific page before being redirected to login | Medium |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 4.6 | **No password reset** — If user forgets password, there is zero path to recovery. Login page has no "Forgot password?" link. **CRITICAL DEAD END.** | Critical |
| 4.7 | **"Contatta il supporto" for email changes** — But no support contact info exists anywhere | Medium |

### Missing Feedback
- No "Last login" information
- No "Login from new device" security notification
- No failed attempt counter or lockout warning

---

## STEP 5: DASHBOARD (/dashboard)
**File**: `@/frontend/src/app/(dashboard)/dashboard/DashboardView.tsx`

### What Happens
User arrives at dashboard. Sees KPI cards, revenue chart, welcome message, quick actions.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 5.1 | **Empty dashboard for new users** — No invoices = no KPIs = no revenue chart = no data. Just "Benvenuto, {name}" and a generic PromoCard | High |
| 5.2 | **No guided onboarding** — No tooltip tour, no "Create your first invoice" wizard, no checklist | High |
| 5.3 | **Organization name is auto-generated** — "{full_name}'s Studio" — looks amateur and user was never asked | Medium |
| 5.4 | **Referral banner shows immediately** — Asking user to refer friends before they've even used the product | Medium |
| 5.5 | **No contextual help** — Dashboard has many elements but no "What's this?" or help tooltips | Low |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 5.6 | **"Importa Documento (OCR)" button** — Unclear what this does without trying it. No explanation of supported formats, accuracy, etc. | Medium |
| 5.7 | **Revenue chart missing for new users** — Entire section disappears when no data; user may not know it exists | Low |
| 5.8 | **"Incassato questo mese" KPI missing** — User doesn't know where this data comes from or how it's calculated | Low |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 5.9 | **"Nessuna organizzazione trovata"** — If org creation trigger fails, user sees error with no action: "Contatta il supporto" — but no support contact | High |
| 5.10 | **PromoCard is just an ad** — Empty state shows upsell card, not actionable guidance | Medium |

### Missing Feedback
- No "You have X invoices due this week" alert
- No "Your first invoice was created!" celebration
- No progress bar for "Complete your profile"

### Missing Onboarding
- No "Step 1: Add your business details" checklist
- No "Step 2: Add your first client" guided flow
- No "Step 3: Create your first invoice" wizard
- No sample/demo data option
- No video tutorial embed

---

## STEP 6: CREATE CLIENT (Prerequisite)
**File**: `@/frontend/src/app/(dashboard)/clients/ClientsView.tsx`

### What Happens
User must create a client before creating an invoice. Goes to Clients page → clicks "+ Nuovo" → fills form → saves.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 6.1 | **No inline client creation in invoice form** — User must navigate away from invoice flow to create a client | High |
| 6.2 | **Client form not audited** — But list view suggests basic form with no validation feedback | Medium |
| 6.3 | **No client import** — Can't import from CSV, Gmail, or existing contacts | Medium |
| 6.4 | **No duplicate detection** — System may create duplicate clients with same email/VAT | Low |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 6.5 | **No client categorization** — All clients in one flat list, no tagging or grouping | Low |

### Missing Onboarding
- No "Import your clients from CSV" option
- No "These are your most valuable clients" insights

---

## STEP 7: CREATE INVOICE (/invoices → modal)
**File**: `@/frontend/src/components/invoices/InvoiceForm.tsx`

### What Happens
User clicks "✦ Nuova Fattura" → modal opens → selects client, adds line items, sets tax/due date → saves.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 7.1 | **Modal blocks context** — User loses sense of where they are in the app | Low |
| 7.2 | **No invoice templates** — Must configure everything from scratch every time | Medium |
| 7.3 | **No invoice preview while editing** — Can't see what the final invoice will look like | High |
| 7.4 | **No recurring invoice option** — For freelancer with monthly retainer, must recreate every month | Medium |
| 7.5 | **No auto-save indicator during typing** — Only shows after 5 seconds of inactivity | Low |
| 7.6 | **AI suggestion buttons (✨) are unclear** — No explanation of what AI will do or how it works | Medium |
| 7.7 | **No duplicate invoice / clone feature** — Must re-enter all data for similar invoices | Medium |
| 7.8 | **No attachment upload** — Can't attach contracts, timesheets, or receipts | Medium |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 7.9 | **"Rit. d'acconto %" field** — No explanation of what this is or when to use it | Medium |
| 7.10 | **Currency selection** — EUR selected by default but no indication if exchange rates are applied | Low |
| 7.11 | **"Scadenza" date** — Defaults to 30 days but no explanation of payment terms | Low |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 7.12 | **Plan limit reached (402)** — Shows error but no clear upgrade path from the modal. Custom event dispatched but parent handler not visible | High |
| 7.13 | **No clients exist** — Shows "Nessun cliente — creane uno" but link navigates away, losing invoice draft | High |

### Missing Feedback
- No "Saving..." intermediate state for line items
- No "Invoice #0042 created successfully" confirmation (just closes modal)
- No "Send now?" prompt after creation

### Missing Onboarding
- No "This is how invoices work in Italy" tooltip
- No "Add your logo for professional invoices" prompt
- No "Set your default payment terms" setup

---

## STEP 8: SEND INVOICE
**File**: `@/frontend/src/app/(dashboard)/invoices/InvoicesView.tsx:31-61`

### What Happens
User clicks "Invia" on draft invoice → API generates Stripe payment link → sends email → marks as "sent".

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 8.1 | **Send process is opaque** — Two API calls happen (generate link + send email) with no progress indication except button text | High |
| 8.2 | **No email preview** — User can't see what the client will receive | Critical |
| 8.3 | **No subject line customization** — Uses default template | Medium |
| 8.4 | **No CC/BCC option** — Can't copy accountant or team member | Medium |
| 8.5 | **No scheduling** — Can't send later; immediate only | Medium |

### Confusion Points
| # | Issue | Severity |
|---|-------|----------|
| 8.6 | **"Payment link" vs "Invoice PDF"** — Unclear what the client receives (email with link? PDF? Both?) | High |
| 8.7 | **No send confirmation** — `alert()` used for errors, but success just updates status badge silently | Medium |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 8.8 | **Stripe link generation fails** — Error shown but no fallback (send without payment link? manual send?) | Medium |
| 8.9 | **Email send fails** — Invoice may be marked as sent in DB but email never delivered | High |

### Missing Feedback
- No "Email delivered" tracking
- No "Client opened email" notification
- No "Payment link clicked" analytics
- No send history or log

---

## STEP 9: EXPORT
**Assessment**: Based on code review

### What Should Happen
User exports invoice as PDF, CSV, or sends to accountant.

### What Actually Happens
**PDF export**: Not found in the audited code. The app uses `@react-pdf/renderer` in dependencies but no export UI visible.

**CSV export**: Mentioned in free plan features but no export button found.

**Accountant export**: Advertised on landing but not implemented.

### Friction Points
| # | Issue | Severity |
|---|-------|----------|
| 9.1 | **No PDF export button** — User cannot download a PDF of their invoice | Critical |
| 9.2 | **No print view** — No print-optimized CSS or print button | Medium |
| 9.3 | **No CSV/Excel export** — Can't export invoice list for accounting | High |
| 9.4 | **No XML/fatturaPA export** — Illegal for Italian B2B invoices | Critical |

### Dead Ends
| # | Issue | Severity |
|---|-------|----------|
| 9.5 | **No export path exists** — The journey literally ends with no way to get data out of the system | Critical |

---

## JOURNEY SUMMARY TABLE

| Step | Friction Points | Confusion Points | Dead Ends | Missing Onboarding | Score |
|------|----------------|------------------|-----------|-------------------|-------|
| 1. Landing | 6 | 2 | 0 | 3 | 4/10 |
| 2. Signup | 6 | 2 | 1 | 4 | 3/10 |
| 3. Confirmation | 4 | 2 | 2 | 3 | 2/10 |
| 4. Login | 3 | 2 | 2 | 0 | 3/10 |
| 5. Dashboard | 5 | 3 | 2 | 5 | 2/10 |
| 6. Create Client | 4 | 1 | 0 | 2 | 3/10 |
| 7. Create Invoice | 8 | 3 | 2 | 3 | 2/10 |
| 8. Send Invoice | 5 | 2 | 2 | 0 | 2/10 |
| 9. Export | 4 | 0 | 1 | 0 | 1/10 |

**AVERAGE JOURNEY SCORE: 2.4/10**

---

## TOP 10 JOURNEY BLOCKERS

1. **No password reset** — Users who forget passwords are permanently locked out
2. **No PDF/XML export** — Invoices cannot be legally used in Italy without export
3. **No email preview** — Users send blind emails without knowing what clients see
4. **No onboarding after signup** — Empty dashboard with no guidance
5. **No inline client creation** — Forces context switching during invoice creation
6. **No invoice preview before save** — Users can't see what they're creating
7. **Fake payment/upgrade links** — Users who want to pay can't (Stripe placeholders)
8. **No email resend** — Users who miss confirmation email have no recourse
9. **No guided first invoice wizard** — New users don't know where to start
10. **No export functionality at all** — Data lock-in with no escape hatch

---

*Document generated by SALAMANDRA-CTO forensic audit*
*Date: 2026-06-02*
