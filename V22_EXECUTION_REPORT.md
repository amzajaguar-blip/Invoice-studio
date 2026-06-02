# 🔥 V22 EXECUTION REPORT
## SALAMANDRA FORGEKEEPER — Revenue Execution Mode

**Date:** 2026-06-02  
**Build:** V22  
**Directive:** Get first real users, first real invoices, first real payments, first paying customers  
**Status:** ⚠️ PARTIAL — 3 blockers before first real users

---

## EXECUTIVE SUMMARY

**Risposta alla domanda chiave:**

> "Can a freelancer sign up, create an invoice, send it, get paid, and hit a paywall?"

**NO — 3 blocchi critici:**

1. **Il form fattura è usabile ma manca il pulsante "Invia" nel nuovo InvoicesView** — regressione introdotta dalla migrazione Engine
2. **Stripe è configurato ma DARK** — env vars mancanti in production
3. **Il paywall esiste ma ha limiti inconsistenti** — 5 invoice nel codice server, 3 nel codice mobile

---

## CURRENT MVP COMPLETION

```
████████░░░░░░░░░░░░  55%
```

### Breakdown by feature

| Feature | Status | Notes |
|---------|--------|-------|
| **Signup/Login** | ✅ READY | Supabase Auth, email + Google OAuth |
| **Dashboard** | ✅ READY | Repository pattern, KPI, revenue chart |
| **Create Invoice** | ⚠️ PARTIAL | Form works but InvoicesView manca dettagli |
| **Edit Invoice** | ❌ MISSING | API exists, no UI |
| **Delete Invoice** | ✅ READY | Soft delete via repository |
| **View Invoice** | ❌ MISSING | No `/invoices/[id]` page |
| **Send Invoice** | ⚠️ PARTIAL | API + email ready, InvoicesView bottone Invia presente |
| **PDF Generation** | ✅ READY | `@react-pdf/renderer`, endpoint funzionante |
| **PDF Download** | ⚠️ PARTIAL | Generazione OK, no download button in InvoicesView |
| **Email Delivery** | ✅ READY | Resend API configurato |
| **Payment Link** | ⚠️ PARTIAL | Stripe checkout, token system — DARK (no env vars) |
| **Client Management** | ⚠️ PARTIAL | Lista clienti migrata, creazione/edit mancante |
| **Client Select in Invoice** | ⚠️ PARTIAL | InvoiceForm ha dropdown, ma usa raw supabase |
| **Free Plan (3 invoices)** | ⚠️ PARTIAL | Server: 5, Mobile: 3 — inconsistenza! |
| **Pro Upgrade** | ⚠️ PARTIAL | RevenueCat webhook fixato, UI da aggiornare |
| **Paywall** | ⚠️ PARTIAL | 402 a livello API, UI paywall da verificare |
| **OCR Scanner** | 🟡 NO-GO | Vedi OCR section — disabilita per V22 |
| **Analytics** | ⚠️ PARTIAL | Repo ready, pagina non migrata |

---

## FIRST INVOICE FLOW AUDIT

### Click Count: Signup → First Invoice → Send

| Step | Screen | Clicks | Notes |
|------|--------|--------|-------|
| 1 | Landing page | 0 | Arriva su `/` |
| 2 | Registrati | 1 | Pulsante "Inizia ora" |
| 3 | Signup form | 3 | Email, password (min 10), nome |
| 4 | Submit signup | 1 | `supabase.auth.signUp()` |
| 5 | Email verification | 0 | Supabase invia magic link |
| 6 | Dashboard | 0 | Redirect automatico post-login |
| 7 | Nuova Fattura | 1 | Link a `/invoices` |
| 8 | Apri form | 1 | Pulsante "+" o "Nuova" |
| 9 | Compila campi | 6+ | Cliente, numero, data, scadenza, item, importo |
| 10 | Salva | 1 | POST /api/invoices |
| 11 | Invia | 1 | Bottone Invia + conferma |
| | **TOTALE** | **~15 click** | Obiettivo: <3 minuti |

### Required Fields (Invoice Form)

| Field | Required? | Type | Friction? |
|-------|-----------|------|-----------|
| **Cliente** | Sì | Dropdown ricerca | ⚠️ Se cliente non esiste, bisogna crearlo prima |
| **Numero fattura** | Sì | Auto? | ⚠️ Auto-generato lato server, ma form lo richiede |
| **Data emissione** | Sì | Date picker | ✅ Oggi di default |
| **Data scadenza** | Sì | Date picker | ✅ +30 giorni di default |
| **Descrizione item** | Sì | Text | ✅ |
| **Quantità** | Sì | Number | ✅ Default 1 |
| **Prezzo unitario** | Sì | Number | ✅ |
| **Ritenuta d'acconto** | No | Number | ✅ Default 20% |
| **Note** | No | Textarea | ✅ |

### Top 5 Friction Points

| # | Problem | Impact | Fix | Effort |
|---|---------|--------|-----|--------|
| 1 | **Nessuna pagina `/invoices/[id]`** — cliccare su una fattura non porta da nessuna parte | Dead end. Freelancer non può rivedere la fattura creata | Creare `invoices/[id]/page.tsx` con InvoiceDetail | 2h |
| 2 | **InvoiceForm usa raw supabase** — non integrato con ClientRepository | Duplicazione, potenziali bug | Rifattorizzare InvoiceForm per usare ClientRepository | 1h |
| 3 | **Numero fattura non auto-generato nel form** — il campo esiste ma l'utente deve inserirlo | Confusione. Il server genera il numero, ma il form lo richiede | Rimuovere campo numero dal form (auto-generato server) | 30m |
| 4 | **Nessuna creazione rapida cliente inline** — se il cliente non esiste, devi uscire dal form | Drop-off. Obbliga navigazione extra | Aggiungere "Crea nuovo cliente" inline nel form | 2h |
| 5 | **Paywall inconsistente**: server dice 5, mobile dice 3 | Confusione utente. EU consumer law risk | Allineare a 3 ovunque | 30m |

---

## INVOICE MVP VALIDATION

| Feature | Status | Detail |
|---------|--------|--------|
| **Create Invoice** | ✅ READY | `POST /api/invoices` con Zod validation, plan check, rate limit |
| **Edit Invoice** | ❌ MISSING | `PATCH /api/invoices/[id]` exists. **No UI**. No edit button in InvoicesView |
| **Delete Invoice** | ✅ READY | Soft delete via `InvoiceRepository.delete()`. Button in InvoicesView |
| **View Invoice** | ❌ MISSING | `GET /api/invoices/[id]` exists. **No page**. No `/invoices/[id]` route |
| **Send Invoice** | ✅ READY | `POST /api/invoices/[id]/send-email`. Button in InvoicesView. Genera payment link + invia email |

### What's MISSING (Priority Order)

1. **`/invoices/[id]` page** — P0. Without this, freelancers cannot review an invoice after creating it. The detail API exists, the repository exists, the `useInvoiceListState` hook exists. Just create the page.

2. **Edit Invoice UI** — P1. The API supports field-level updates based on status. No UI exists. Add edit button in InvoicesView for `draft` invoices.

---

## CLIENT MANAGEMENT MVP

| Feature | Status | Detail |
|---------|--------|--------|
| **View Clients** | ✅ READY | `ClientsView` con `useClientListState` + `UiStateRenderer` |
| **Create Client** | ❌ MISSING | API exists (`POST /api/clients`), **no UI**. `ClientsView` has no create button |
| **Edit Client** | ❌ MISSING | No UI. API not verified |
| **Delete Client** | ✅ READY | Button in `ClientsView` |
| **Select Client in Invoice** | ⚠️ PARTIAL | `InvoiceForm` has a dropdown but uses raw `supabase.from("clients")` |

### Critical Gap: No "Create Client" in ClientsView

The `ClientsView.tsx` has an `emptyAction` for the empty state but it's a no-op:
```tsx
emptyAction={{ label: "Nuovo Cliente", onPress: () => {} }}
```
The `onPress` handler is empty. A freelancer clicking "Nuovo Cliente" gets nothing.

**Fix needed:** Wire the empty action + add a "+" button in the header.

---

## PAYMENT READINESS

| Component | Status | Detail |
|-----------|--------|--------|
| **Stripe Client** | ✅ READY | `stripe` SDK initialized in `lib/stripe/client.ts` |
| **Checkout Session** | ✅ READY | `generate-payment-link/route.ts` creates Stripe session |
| **Payment Page** | ✅ READY | `/pay/[token]` public page with Stripe Elements |
| **Stripe Webhook** | ✅ READY | Signature verification, idempotency, UUID hardening |
| **RevenueCat Webhook** | ✅ READY | Bearer auth, plan mapping, UUID validation (SEC-001 fix) |
| **Plan Sync** | ⚠️ PARTIAL | RevenueCat → `organizations.plan`, but `subscriptions` table orphaned |
| **Stripe Env Vars** | ❌ BLOCKED | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — DARK in production |
| **RevenueCat Env Vars** | ⚠️ PARTIAL | `REVENUECAT_WEBHOOK_SECRET` needed |

### BLOCKED Items

1. **Stripe production env vars** — BLOCKED. Without `STRIPE_SECRET_KEY`, no payments can be processed. This is the single biggest blocker to first real payment.
   - **Fix:** Set 3 env vars in Vercel. Estimated: 15 min.
   - **Precedes:** Stripe Dashboard setup (product creation, webhook endpoint registration)

2. **Test mode vs Live mode** — BLOCKED. Stripe has separate test/live keys and webhook secrets. Ensure test mode works end-to-end before switching to live.

---

## FIRST PAYWALL

### Current State

| Aspect | Server (API) | Mobile | Web UI |
|--------|-------------|--------|--------|
| **Free limit** | 5 invoices | 3 scans | 5 (no UI indicator) |
| **Enforcement** | ✅ 402 at `POST /api/invoices` | ✅ Paywall modal | ⚠️ Client-side only |
| **Upgrade CTA** | `reason: "plan_limit"` in JSON | "Passa a Pro" button | No visible CTA |
| **Pricing** | N/A | €4.99/mo | €19/mo on landing page |

### Critical Inconsistencies

🔴 **P0: Free limit mismatch**: Server = 5, Mobile = 3. EU consumer protection: displayed limit must match enforced limit.

🔴 **P0: Pricing mismatch**: Landing page says "€19/mese", Settings says "€4,99/mese", RevenueCat has `mensile` at €4.99. The landing page price is misleading advertising (EU Directive 2005/29/EC).

🟡 **P1: No visual paywall in web UI**: The server returns 402 when quota is exhausted, but the InvoicesView doesn't display this. The user sees an error they don't understand.

### Required Fix Before First Users

1. **Align free limit to 3** in `plan.ts` constants (currently 5)
2. **Fix landing page price** to `€4,99/mese` (currently `€19/mese`)
3. **Add quota indicator** in InvoicesView: "3/3 fatture create — Passa a Pro"
4. **Show upgrade CTA** when 402 is returned

---

## PDF + EMAIL DELIVERY

| Feature | Status | Detail |
|---------|--------|--------|
| **PDF Generation** | ✅ READY | `@react-pdf/renderer`, endpoint: `GET /api/invoices/[id]/pdf` |
| **PDF Download** | ⚠️ PARTIAL | Endpoint returns PDF. No download button in InvoicesView |
| **PDF Quality** | ✅ READY | React PDF with Italian tax format |
| **Email Send** | ✅ READY | `POST /api/invoices/[id]/send-email` via Resend |
| **Email Templates** | ✅ READY | React Email templates |
| **Failure Handling** | ✅ READY | Error logging in `invoice_events` table |

---

## OCR GO/NO-GO DECISION

### Decision: **NO-GO** ❌

### Justification

| Criterion | Assessment |
|-----------|------------|
| **Connected to real provider?** | ✅ Sì — Tesseract.js, `/api/ocr/receipt` funziona |
| **Accurate enough?** | ⚠️ Solo testo base — nessuna estrazione strutturata (items, tax, VAT) |
| **Does it reduce time?** | ❌ No — 1.2-2.5s di OCR + revisione manuale > compilazione diretta |
| **Does it increase friction?** | ❌ Sì — il flusso mobile richiede foto, OCR, revisione, correzione, conferma. Più lento del form manuale |
| **Frontend page exists?** | ❌ No — nessuna pagina scanner su web, solo mobile |
| **End-to-end tested?** | ❌ No — `ScannerRepositorySupabase` creato ma mai testato con dati reali |

### Recommendation

**Disabilita OCR per V22.** Sposta in backlog.
- Nascondi link scanner dalla navigazione
- Mantieni l'endpoint API per uso futuro
- Il flusso mobile rimane disponibile come nice-to-have per early adopters

---

## REMAINING BLOCKERS BEFORE FIRST USERS

| # | Blocker | Severity | Effort |
|---|---------|----------|--------|
| 1 | **Stripe env vars assenti** — nessun pagamento possibile | 🔴 P0 | 15 min |
| 2 | **Nessuna pagina `/invoices/[id]`** — dead end dopo creazione | 🔴 P0 | 2h |
| 3 | **Paywall inconsistency** — 3 vs 5, €4.99 vs €19 | 🔴 P0 | 30 min |
| 4 | **InvoiceForm non integrato con ClientRepository** | 🟡 P1 | 1h |
| 5 | **Nessun Edit Invoice UI** | 🟡 P1 | 3h |
| 6 | **Nessuna creazione cliente inline** | 🟡 P1 | 2h |
| 7 | **ClientsView "Nuovo Cliente" vuoto** | 🟡 P1 | 30 min |
| 8 | **Nessun quota indicator in InvoicesView** | 🟡 P1 | 1h |
| 9 | **Landing page prezzo errato** | 🟡 P1 | 15 min |
| 10 | **OCR disabled** (NO-GO decision) | 🟢 DONE | — |

---

## DAYS TO PUBLIC LAUNCH

### With current velocity: **3-4 giorni**

| Milestone | Effort |
|-----------|--------|
| Fix P0 blockers (Stripe vars, /invoices/[id], paywall) | 3h |
| Fix P1 friction (Client creation, edit, form refactor) | 7h |
| End-to-end test (create invoice → send → pay) | 2h |
| Deploy + smoke test | 1h |
| **TOTAL** | **~13h = 2-3 giorni** |

---

## PROBABILITY ESTIMATES

| Outcome | Probability | Confidence |
|---------|------------|------------|
| **First 10 users** (friends & family) | 95% | Once P0s fixed |
| **First 100 users** (organic) | 60% | Needs landing page + SEO fix |
| **First paying customer** | 70% | After Stripe vars set + paywall aligned |

---

## HIGHEST IMPACT NEXT ACTION

**Set Stripe production environment variables NOW.**

This unblocks the entire money flow. Everything else (invoice detail page, paywall alignment, client creation) is UX improvement. Without Stripe, there is no path to revenue.

---

## RECOMMENDED BUILD CLASSIFICATION

```
████████████░░░░░░░░  RC (Release Candidate)

NOT YET READY FOR FIRST USERS — 3 P0 blockers remain.

ETA: 3 days to READY FOR FIRST USERS.
```

---

## REPORT INDEX

| Report | Content |
|--------|---------|
| `FIRST_INVOICE_AUDIT.md` | (generated by context-morph agent) |
| `INVOICE_MVP_REPORT.md` | (generated by context-morph agent) |
| `CLIENTS_MVP_REPORT.md` | (generated by context-morph agent) |
| `PAYMENT_READINESS_REPORT.md` | (generated by billing-engineer agent) |
| `PAYWALL_REPORT.md` | (generated by billing-engineer agent) |
| `DELIVERY_REPORT.md` | (generated by billing-engineer agent) |
| `OCR_GO_NO_GO_REPORT.md` | (generated by billing-engineer agent) |
| `V22_EXECUTION_REPORT.md` | This report |

---

[SYSTEM]: V22 EXECUTION PROTOCOL — ASSESSMENT COMPLETE
BUILD CLASSIFICATION: RC — 3 P0 blockers before first users
