# ⚔️ 01 — EXECUTION PLAN (BATTLE PLAN)

> Ogni task ha Impact (1-5), Difficulty (1-5), tempo stimato, e business impact atteso.
> Massimo 10 task. Nessuna eccezione. Ogni feature deve giustificare la sua esistenza.

---

## WEEK 1 — CRITICAL FIXES (Day 1-7)

---

### TASK 1: SECURITY EMERGENCY — Rimuovere Keystore Hardcoded
- Impact: 5/5
- Difficulty: 1/5
- Tempo: 2 ore
- Business impact: Se non fatto, ogni build è un rischio. Se fatto, la base è sicura.
- Owner: DevOps/Security

**Problema:** Il file `.github/workflows/build-twa.yml` conteneva il keystore Base64 hardcoded in plaintext. Il commit 8868f1b ha corretto build-aab.yml ma build-twa.yml era rimasto esposto. La password VelaStorePass2026! era visibile nella git history.

**Status:** ✅ FILE ELIMINATO (commit 4179174). Rimane da:
1. Pulire git history con BFG Repo-Cleaner
2. Rigenerare keystore con password nuova (la vecchia è compromessa)
3. Caricare nuovo keystore in GitHub Secrets

**Definition of Done:**
- [x] build-twa.yml eliminato
- [ ] Nessun keystore Base64 in nessun file del repo
- [ ] grep -rn "MIIK" .github/ restituisce zero risultati
- [ ] Nuovo keystore generato e caricato in GitHub Secrets
- [ ] Git history pulita (verificare con git log -p | grep MIIK)
- [ ] Pre-commit hook aggiunto per prevenire futuro hardcoded keystore

---

### TASK 2: PDF EXPORT — Implementare Download PDF Fattura
- Impact: 5/5
- Difficulty: 3/5
- Tempo: 1 giorno
- Business impact: +15 punti Product Score. Senza PDF, l'app è illegale per uso B2B in Italia.
- Owner: Fullstack

**Problema:** @react-pdf/renderer è in package.json ma non usato per export. InvoiceDetailPanel.tsx non ha bottoni export.

**File da creare/modificare:**
- frontend/src/lib/pdf/invoice-template.tsx (NUOVO — template PDF React)
- frontend/src/app/api/invoices/[id]/pdf/route.ts (esiste, verificare)
- frontend/src/components/invoices/InvoiceDetailPanel.tsx (aggiungere bottoni)
- mobile/lib/pdf-utils.ts (verificare, mobile share)

**Specifiche PDF Italian Invoice:**
- Header: Logo azienda + nome + indirizzo + P.IVA
- Client block: Nome, indirizzo, P.IVA, Codice Destinatario
- Line items table: descrizione, qty, prezzo, IVA, totale
- Summary: imponibile, IVA 22%, ritenuta d'acconto, totale
- Payment info: Stripe link (QR code opzionale)
- Footer: numero fattura, data, condizioni
- Italian formatting: EUR symbol, date DD/MM/YYYY

**Definition of Done:**
- [ ] Template PDF renderizzato server-side con @react-pdf/renderer
- [ ] Bottoni "Download PDF" e "Stampa" nel InvoiceDetailPanel
- [ ] PDF salvato in Supabase Storage per invio email
- [ ] Mobile: condivisione PDF via expo-sharing
- [ ] Test: PDF generato contiene tutti i campi obbligatori italiani
- [ ] PDF include: logo, P.IVA, breakdown IVA, ritenuta, totale

---

### TASK 3: REVENUECAT — Inizializzare SDK Mobile
- Impact: 4/5
- Difficulty: 3/5
- Tempo: 1 giorno
- Business impact: Mobile paywall completamente rotto. Senza RC, utenti mobile non possono pagare.
- Owner: Mobile Dev

**Problema:** react-native-purchases (v10.1.2) è installato ma Purchases.configure() non è MAI chiamato. Prezzi hardcoded in due schermi diversi (€19/mese in InvoiceLimitModal, €4.99/mese in ProUpgrade).

**File da creare/modificare:**
- mobile/lib/revenuecat.ts (NUOVO — init + helpers)
- mobile/app/_layout.tsx (aggiungere configureRevenueCat)
- mobile/app/(app)/ProUpgrade.tsx (riscrivere con real API)
- mobile/app/(app)/InvoiceLimitModal.tsx (usare useProPrice hook)
- mobile/hooks/useProPrice.ts (NUOVO — shared price source)

**Passi:**
1. Creare mobile/lib/revenuecat.ts con configureRevenueCat(), getOfferings(), purchasePackage()
2. In _layout.tsx, dopo auth check, chiamare configureRevenueCat(user.id)
3. Riscrivere ProUpgrade.tsx: usare getOfferings() + purchasePackage() invece di setTimeout stub
4. Creare useProPrice() hook per leggere prezzo da RC (single source of truth)
5. Aggiungere EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in EAS env

**Definition of Done:**
- [ ] Purchases.configure() chiamato in _layout.tsx
- [ ] ProUpgrade.tsx usa getOfferings() + purchasePackage()
- [ ] InvoiceLimitModal.tsx usa useProPrice() hook
- [ ] Prezzi non hardcoded (letti da RevenueCat)
- [ ] EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in EAS env
- [ ] Error handling per purchase failure
- [ ] Loading states durante acquisto

---

### TASK 4: STRIPE — Checkout + Customer Portal Reali
- Impact: 5/5
- Difficulty: 4/5
- Tempo: 6 ore
- Business impact: Senza pagamenti reali, il prodotto è un prototipo. +12 punti Commercial Score.
- Owner: Fullstack

**Problema:** Settings page ha href="https://buy.stripe.com/your_link" e href="https://billing.stripe.com/p/your_portal" — entrambi fake.

**File da creare/modificare:**
- frontend/src/app/api/stripe/checkout/route.ts (NUOVO)
- frontend/src/app/api/stripe/portal/route.ts (NUOVO)
- frontend/src/app/api/webhooks/stripe/route.ts (verificare)
- frontend/src/app/(dashboard)/settings/SettingsClient.tsx (replace fake links)
- frontend/src/lib/stripe.ts (NUOVO — Stripe client)

**Passi:**
1. Creare Stripe Products + Prices (€5/mese recurring)
2. Implementare /api/stripe/checkout con stripe.checkout.sessions.create()
3. Implementare /api/stripe/portal con stripe.billingPortal.sessions.create()
4. Webhook handler per checkout.session.completed, customer.subscription.deleted
5. Update user_plans table dopo webhook
6. Sostituire fake links in SettingsClient con redirect a API routes
7. Fix ritenuta d'acconto: rimuovere dallo Stripe Checkout (solo informativa nel PDF)

**Definition of Done:**
- [ ] Stripe Checkout funzionante (€5/mese recurring)
- [ ] Customer Portal funzionante (cancel, view invoices)
- [ ] Webhook handler per 3 eventi critici
- [ ] user_plans table aggiornata dopo pagamento
- [ ] Rate limiting su checkout endpoint
- [ ] Test E2E: signup → upgrade → cancel → verify downgrade
- [ ] Fix ritenuta d'acconto (rimossa dal Checkout, solo informativa)

---

### TASK 5: PASSWORD RESET — Flow Completo
- Impact: 3/5
- Difficulty: 2/5
- Tempo: 4 ore
- Business impact: +8 punti. Senza reset, utenti dimenticano password = churn permanente.
- Owner: Frontend

**File da verificare/modificare:**
- frontend/src/app/(auth)/forgot-password/page.tsx (ESISTE — verificare)
- frontend/src/app/(auth)/reset-password/page.tsx (ESISTE — verificare)
- frontend/src/app/(auth)/login/page.tsx (aggiungere link "Password dimenticata?")

**Passi:**
1. Verificare che /forgot-password e /reset-password esistano già (git ls-files conferma)
2. Testare il flow completo end-to-end
3. Aggiungere link "Password dimenticata?" in login page
4. Configurare email template italiano (Resend SMTP)
5. Aggiungere rate limiting (max 3 richieste/ora)
6. Aggiungere "Non ho ricevuto l'email" link

**Definition of Done:**
- [ ] /forgot-password route funzionante con email input
- [ ] /reset-password route funzionante con new password form
- [ ] Link "Password dimenticata?" visibile in login
- [ ] Email reset in italiano (custom template)
- [ ] Rate limiting implementato
- [ ] Redirect post-reset a /login?reset=success
- [ ] Test E2E: forgot → email → click → reset → login

---

## WEEK 2 — PRODUCT COMPLETENESS (Day 8-14)

---

### TASK 6: ONBOARDING — Wizard 3-Step Post-Signup
- Impact: 4/5
- Difficulty: 3/5
- Tempo: 1 giorno
- Business impact: +10 punti UX Score. First-week retention da <5% a 20%+.
- Owner: Frontend

**Problema:** Dashboard vuota per nuovi utenti. Nessuna guida. "What do I do now?" → abbandono.

**File da creare/modificare:**
- frontend/src/components/onboarding/OnboardingWizard.tsx (NUOVO)
- frontend/src/components/onboarding/Step1Profile.tsx (NUOVO)
- frontend/src/components/onboarding/Step2FirstScan.tsx (NUOVO)
- frontend/src/components/onboarding/Step3FirstInvoice.tsx (NUOVO)
- frontend/src/app/(dashboard)/dashboard/DashboardView.tsx (mostrare wizard su first login)
- frontend/src/app/api/profile/route.ts (aggiungere onboarding_completed flag)

**Specifiche Wizard:**
- Step 1: "Completa il tuo profilo" — business name, P.IVA, indirizzo, logo upload
- Step 2: "Aggiungi il tuo primo cliente" — form inline, skip option
- Step 3: "Crea la tua prima fattura" — pre-filled sample data, OCR scan option, confetti

**Definition of Done:**
- [ ] Wizard mostrato su first login (check onboarding_completed flag)
- [ ] 3 step funzionanti con navigazione avanti/indietro
- [ ] Skip option disponibile (ma tracked)
- [ ] Confetti animation su completamento
- [ ] onboarding_completed flag salvato in DB
- [ ] Dashboard mostra CTA "SCAN" dopo onboarding

---

### TASK 7: EMAIL — Preview + Italian Templates
- Impact: 3/5
- Difficulty: 3/5
- Tempo: 6 ore
- Business impact: +6 punti UX, +3 punti Trust. Email conferma in italiano = +activation rate.
- Owner: Fullstack

**Problema:**
1. Email inviata senza preview (utenti hanno paura)
2. Email conferma Supabase in inglese, sender noreply@...supabase.co (spam-folder)

**Passi:**
1. Creare EmailPreviewModal con render del template (subject + body + attachment)
2. Aggiungere "Preview Email" button in InvoiceDetailPanel
3. Configurare Resend SMTP in Supabase
4. Customizzare email templates: Confirmation, Reset, Magic Link — tutti in italiano
5. Sender: InvoiceStudio <noreply@invoicestudio.it>

**Definition of Done:**
- [ ] EmailPreviewModal mostra subject + body + attachment list
- [ ] "Preview Email" button in InvoiceDetailPanel
- [ ] Email conferma in italiano
- [ ] Sender custom (non Supabase default)
- [ ] Test: ricezione email non finisce in spam

---

### TASK 8: FATTURAPA / SDI — XML Export (Se B2B Target)
- Impact: 3/5
- Difficulty: 5/5
- Tempo: 3 giorni
- Business impact: +10 punti. Obbligatorio per B2B in Italia dal 2019.

**Decision Gate:** Se target è solo B2C, defer to P1. Se B2B è target, è P0.

**Problema:** Zero riferimenti a fatturaPA, SDI, Codice Destinatario, o XML export nel codebase.

**File da creare/modificare:**
- backend/migration_fatturapa.sql (NUOVO — campi aggiuntivi)
- frontend/src/lib/fatturapa/xml-generator.ts (NUOVO)
- frontend/src/lib/fatturapa/xsd-schema.xsd (NUOVO — validation)
- frontend/src/app/api/invoices/[id]/fatturapa/route.ts (NUOVO)
- frontend/src/components/invoices/FatturaPAExport.tsx (NUOVO)
- frontend/src/components/clients/ClientForm.tsx (aggiungere Codice Destinatario + PEC)

**Passi:**
1. Migration: aggiungere codice_destinatario, pec a clients
2. Migration: aggiungere regime_fiscale, tipo_cassa a profiles
3. Creare XML generator conforme schema fatturaPA 1.2
4. Validation XML con XSD
5. UI: field Codice Destinatario (7 char) e PEC in ClientForm
6. UI: "Export FatturaPA XML" button in InvoiceDetailPanel
7. Integrazione SDI via API (Aruba, FatturaPA Cloud, o export manuale)

**Definition of Done:**
- [ ] XML fatturaPA generato correttamente da dati fattura
- [ ] XML valida contro XSD schema 1.2
- [ ] Campi client aggiornati (codice_destinatario, pec)
- [ ] Campi profile aggiornati (regime_fiscale, tipo_cassa)
- [ ] UI export XML funzionante
- [ ] Test con dati reali italiani

---

### TASK 9: SECURITY HARDENING — Fix Remaining P1 Issues
- Impact: 3/5
- Difficulty: 3/5
- Tempo: 1 giorno
- Business impact: +20 punti Security Score. Da 35 a 85.
- Owner: Security + Backend

**Passi:**
1. Cron auth: Aggiungere Authorization: Bearer CRON_SECRET a tutti i cron routes
2. Rewarded ads: Route tutto credito attraverso server, validare AdMob callback
3. Sentry DSN: Muovere da hardcoded a NEXT_PUBLIC_SENTRY_DSN env var
4. RLS verification: Script test per verificare RLS policies su tutte le tabelle
5. Email templates: Customizzare in italiano (vedi Task 7)

**Definition of Done:**
- [ ] Tutti i cron routes richiedono auth header
- [ ] Rewarded ads validato server-side
- [ ] Sentry DSN in env var
- [ ] RLS testati su 5+ tabelle critiche
- [ ] Email templates in italiano

---

### TASK 10: PLAY STORE — AAB Upload + Listing
- Impact: 4/5
- Difficulty: 2/5
- Tempo: 4 ore (dopo task 1-9 completati)
- Business impact: Da prototipo a prodotto pubblicato.
- Owner: DevOps + Product

**Prerequisiti:** Task 1-9 completati.

**Passi:**
1. Build AAB release con workflow build-aab.yml (manuale trigger)
2. Verificare AAB: firma, versionCode, targetSdk
3. Play Console → Internal Testing → Upload AAB
4. Compilare listing: titolo, descrizione, screenshot, feature graphic
5. Compilare Data Safety form
6. Compilare Content Rating
7. Submit for review

**Definition of Done:**
- [ ] AAB build successful (artifact uploadato)
- [ ] AAB uploadato su Play Console
- [ ] Listing completo (titolo, descrizione, screenshot)
- [ ] Data Safety form compilata
- [ ] Content Rating compilato
- [ ] Privacy Policy e Terms accessibili
- [ ] Submit for review (24-72h)

---

## 📊 EXECUTION SUMMARY

| Task | Impact | Difficulty | Tempo | Dependencies |
|------|--------|------------|-------|--------------|
| 1. Keystore fix | 5 | 1 | 2h | None |
| 2. PDF Export | 5 | 3 | 1d | None |
| 3. RevenueCat | 4 | 3 | 1d | None |
| 4. Stripe real | 5 | 4 | 6h | Task 3 (mobile parity) |
| 5. Password reset | 3 | 2 | 4h | None |
| 6. Onboarding | 4 | 3 | 1d | Task 2 (PDF per wizard) |
| 7. Email preview | 3 | 3 | 6h | Task 2 (PDF per attachment) |
| 8. FatturaPA/SDI | 3 | 5 | 3d | Task 2 (dati fattura) |
| 9. Security hardening | 3 | 3 | 1d | Task 1 |
| 10. Play Store | 4 | 2 | 4h | ALL |

**Tempo totale stimato:** 10-14 giorni (1 developer full-time)

### Critical Path
Task 1 (2h) → Task 9 (1d) → Task 10 (4h)
Task 2 (1d) → Task 6 (1d) → Task 10
Task 2 (1d) → Task 7 (6h) → Task 10
Task 2 (1d) → Task 8 (3d) → Task 10
Task 3 (1d) → Task 4 (6h) → Task 10
Task 5 (4h) → Task 10

### Parallelizzazione possibile
- Dev A (Frontend): Task 2, 6, 7, 8
- Dev B (Mobile/DevOps): Task 1, 3, 4, 9
- Dev C (Product/QA): Task 5, 10, testing

---

## 📋 DAILY CHECKLIST (14 GIORNI)

### Giorno 1
- [ ] Task 1: Pulire git history (BFG)
- [ ] Task 1: Generare nuovo keystore
- [ ] Task 1: Aggiungere GitHub Secrets
- [ ] Task 1: Aggiungere pre-commit hook
- [ ] Task 2: Creare invoice-template.tsx
- [ ] Task 2: Implementare API PDF route

### Giorno 2
- [ ] Task 2: Aggiungere bottoni PDF in InvoiceDetailPanel
- [ ] Task 2: Test PDF export
- [ ] Task 3: Creare revenuecat.ts
- [ ] Task 3: Inizializzare in _layout.tsx

### Giorno 3
- [ ] Task 3: Riscrivere ProUpgrade.tsx
- [ ] Task 3: Creare useProPrice hook
- [ ] Task 3: Test purchase flow (sandbox)
- [ ] Task 4: Configurare Stripe Products

### Giorno 4
- [ ] Task 4: Implementare checkout route
- [ ] Task 4: Implementare portal route
- [ ] Task 4: Aggiornare webhook handler

### Giorno 5
- [ ] Task 4: Sostituire fake links in SettingsClient
- [ ] Task 4: Fix ritenuta d'acconto
- [ ] Task 4: Test E2E payment
- [ ] Task 5: Verificare forgot/reset password routes

### Giorno 6
- [ ] Task 5: Aggiungere link in login
- [ ] Task 5: Configurare email template italiano
- [ ] Task 5: Test reset flow
- [ ] Task 6: Creare OnboardingWizard component

### Giorno 7
- [ ] Task 6: Implementare 3 step
- [ ] Task 6: Aggiungere onboarding_completed flag
- [ ] Task 6: Test onboarding flow
- [ ] Task 9: Aggiungere auth alle cron routes

### Giorno 8-10
- [ ] Task 8: Migration fatturaPA campi
- [ ] Task 8: Creare XML generator
- [ ] Task 8: Validation XSD
- [ ] Task 8: UI export XML

### Giorno 11
- [ ] Task 9: Fix rewarded ads bypass
- [ ] Task 9: Muovere Sentry DSN in env
- [ ] Task 9: Test RLS policies

### Giorno 12
- [ ] Task 7: EmailPreviewModal
- [ ] Task 7: Configurare Resend SMTP
- [ ] Task 7: Customizzare email templates

### Giorno 13
- [ ] Testing completo end-to-end
- [ ] Fix regressioni
- [ ] Build APK debug per tester

### Giorno 14
- [ ] Task 10: Build AAB release
- [ ] Task 10: Upload Play Console
- [ ] Task 10: Compilare listing
- [ ] Task 10: Submit for review
- [ ] LAUNCH

---

*Generated by SALAMANDRA FORGEKEEPER*
