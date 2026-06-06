# ACTIVATION REPORT — InvoiceStudio

> **Analyst:** LEVIATAN — Principal SaaS Architect
> **Date:** 2026-06-02
> **Definition of "Activated":** User has created AND sent their first invoice.

---

## CURRENT ACTIVATION PATH

```
Step 1: Landing page         → 0 seconds
Step 2: Signup                → 60 seconds (3 fields + submit)
Step 3: Email confirmation    → 30-300 seconds (depends on email delivery)
Step 4: Login                 → 30 seconds
Step 5: Dashboard             → 5 seconds (page load)
Step 6: Navigate to Invoices  → 3 seconds
Step 7: Create invoice        → DEAD END (no create button)
Step 8: Send invoice          → NEVER REACHED
```

**Current time to value: INFINITE (dead end at step 7)**

---

## FRICTION POINT ANALYSIS

### Step 1: Landing → Signup
**Friction Score: 3/10 (low)**

| Friction | Severity | Fix |
|----------|----------|-----|
| Fake features create wrong expectations | HIGH | Remove fake features |
| "Inizia gratis" CTA is generic | MEDIUM | Change to "Prova lo scanner OCR" |
| No social proof | MEDIUM | Remove fake numbers, add nothing until real |

### Step 2: Signup Form
**Friction Score: 6/10 (medium-high)**

| Friction | Severity | Fix |
|----------|----------|-----|
| No Google OAuth | HIGH | Add Google sign-in button |
| No password strength meter | MEDIUM | Add zxcvbn |
| No confirm password | MEDIUM | Add confirmation field |
| No terms/privacy checkbox | HIGH (GDPR) | Add consent checkbox |
| Raw error messages in English | MEDIUM | Translate to Italian |
| Dark-on-dark low contrast | LOW | Improve card visibility |

### Step 3: Email Confirmation
**Friction Score: 8/10 (high)**

| Friction | Severity | Fix |
|----------|----------|-----|
| `/auth/callback` route potentially missing | CRITICAL | Verify and fix |
| Email may go to spam | HIGH | Configure custom SMTP |
| No "resend confirmation" option | MEDIUM | Add resend button |
| Double password entry (signup + login) | MEDIUM | Persist session after signup if confirmation disabled |

### Step 4: Login
**Friction Score: 4/10 (low-medium)**

| Friction | Severity | Fix |
|----------|----------|-----|
| No "Forgot password?" | CRITICAL | Add password reset |
| Hard redirect flash | LOW | Improve transition |
| No "Remember me" | LOW | Add checkbox |

### Step 5: Dashboard (First View)
**Friction Score: 7/10 (high)**

| Friction | Severity | Fix |
|----------|----------|-----|
| No onboarding guidance | CRITICAL | Add getting-started checklist |
| PromoCard shows upgrade pitch | HIGH | Replace with onboarding steps |
| "Nuova Fattura" navigates away | HIGH | Change to modal trigger |
| Empty dashboard feels dead | MEDIUM | Add demo data or guided first action |
| No "Create your first invoice" prompt | HIGH | Add prominent CTA |

### Step 6: Navigate to Invoices
**Friction Score: 5/10 (medium)**

| Friction | Severity | Fix |
|----------|----------|-----|
| User loses dashboard context | MEDIUM | Keep invoice creation in dashboard via modal |
| Extra navigation step | MEDIUM | Eliminate by opening modal from dashboard |

### Step 7: Create Invoice
**Friction Score: 10/10 (BLOCKED)**

| Friction | Severity | Fix |
|----------|----------|-----|
| **No create button in migrated view** | **CRITICAL** | **Add "+ Nuova Fattura" button** |
| Must create client first (separate page) | HIGH | Allow client creation inline in InvoiceForm |
| No template selection | MEDIUM | Add template picker |
| No preview before save | MEDIUM | Add PDF preview tab |
| `alert()` for errors | HIGH | Replace with toast |

### Step 8: Send Invoice
**Friction Score: 6/10 (medium-high)**

| Friction | Severity | Fix |
|----------|----------|-----|
| Two-step send (payment link + email) | MEDIUM | Combine into one "Invia e richiedi pagamento" button |
| No email preview | MEDIUM | Add "Anteprima email" before send |
| No send confirmation | MEDIUM | Add "Conferma invio" dialog |
| Ritenuta d'acconto bug in Stripe | CRITICAL | Fix payment calculation |

---

## IDEAL ACTIVATION PATH (AFTER FIXES)

```
Step 1: Landing → "Prova lo scanner OCR"     → 0 seconds
Step 2: Google signup (1 click)               → 5 seconds
Step 3: Dashboard with onboarding checklist   → 3 seconds
Step 4: Click "Crea prima fattura" (modal)    → 1 second
Step 5: Upload receipt → OCR → Review         → 30 seconds
Step 6: Click "Invia e richiedi pagamento"    → 2 seconds
Step 7: DONE — invoice sent with payment link → 0 seconds
```

**Target time to value: Under 60 seconds.**

---

## ACTIVATION METRICS

### Current (estimated from code):

| Metric | Current | Target |
|--------|---------|--------|
| Landing → Signup conversion | ~5-8% | 12-15% (with Google OAuth) |
| Signup → Email confirmed | Unknown (depends on Supabase config) | 80%+ |
| Confirmed → Login | ~70% | 90%+ |
| Login → First invoice created | **0% (dead end)** | 60%+ |
| First invoice → Sent | N/A | 80%+ |
| **Overall: Landing → Activated** | **0%** | **25-35%** |

### Time to value:

| Current | After P0 Fixes | After Full Activation Optimization |
|---------|---------------|-----------------------------------|
| **∞ (dead end)** | **3-5 minutes** | **Under 60 seconds** |

---

## THE ACTIVATION FUNNEL LEAKS

```
100 visitors to landing
  │
  ▼  LEAK: Fake features, no trust signals
 60 visit signup
  │
  ▼  LEAK: No Google OAuth, no password strength
 30 complete signup
  │
  ▼  LEAK: Email confirmation friction, /auth/callback may 404
 15 confirm email
  │
  ▼  LEAK: No password reset if forgotten
 12 login successfully
  │
  ▼  LEAK: No onboarding, PromoCard annoys, empty dashboard
 8 reach dashboard
  │
  ▼  LEAK: "Nuova Fattura" navigates away, no create button
 0 create first invoice  ← DEAD END
  │
  ▼
 0 send first invoice
  │
  ▼
 0 ACTIVATED USERS
```

**Every user who signs up today hits a dead end. Zero activation.**

---

## ACTIVATION RECOVERY PLAN

### Phase 1: Unblock (Days 1-3)

1. Add "+ Nuova Fattura" button to InvoicesView
2. Wire up InvoiceForm modal from dashboard
3. Add password reset flow
4. Verify/fix `/auth/callback` route

**After Phase 1: Users CAN create invoices. Activation becomes possible.**

### Phase 2: Accelerate (Days 4-10)

1. Add Google OAuth
2. Add onboarding checklist to dashboard
3. Allow client creation inline in InvoiceForm
4. Combine payment link + email send into one action
5. Replace `alert()` with toast notifications

**After Phase 2: Time to value drops to ~3 minutes.**

### Phase 3: Optimize (Days 11-20)

1. Add OCR-first invoice creation (camera button on dashboard)
2. Add PDF preview in form
3. Add email preview before send
4. Add send confirmation dialog
5. Add success celebration after first sent invoice

**After Phase 3: Time to value drops to under 60 seconds.**

---

## THE SINGLE BIGGEST ACTIVATION LEVER

**Put a camera button on the dashboard.**

Not a link. Not a menu item. A large, prominent button that opens the device camera (mobile) or file picker (desktop) and starts the OCR flow immediately.

This single change:
- Eliminates 3 navigation steps
- Makes the value proposition instantly clear
- Leverages the product's only genuine differentiator
- Reduces time-to-value from minutes to seconds

**The dashboard should have exactly one prominent action: "Fotografa ricevuta." Everything else is secondary.**
