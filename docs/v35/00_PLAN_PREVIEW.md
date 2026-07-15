# 🏗️ INVOICE STUDIO — PIANO ESECUTIVO V35
## "Operation Leviathan: From Prototype to Play Store Ready"

> **Autore:** ZIZ — Supreme Build Factory Architect
> **Data:** 2026-07-04
> **Versione:** V35.0
> **Obiettivo:** Portare Invoice Studio da stato attuale (prototipo, 32/100) a **Play Store Ready** (80+ score) con AAB/APK funzionanti, pagamenti reali, e flusso OCR→PDF→Email end-to-end.
> **Modello:** Source code product (Lorenzo vende su Gumroad come Sellerstone)

---

## 📊 EXECUTIVE SUMMARY

### Stato Attuale (Forensic Audit)
| Metrica | Score | Verdetto |
|---------|-------|----------|
| Product Score | 32/100 | ❌ NOT READY |
| Commercial Score | 18/100 | ❌ NOT READY |
| UX Score | 28/100 | ❌ NOT READY |
| SaaS Readiness | 24/100 | ❌ NOT READY |
| Play Store Readiness | 45/100 | ⚠️ PARTIAL |
| Security | 35/100 | ❌ CRITICAL ISSUES |

### Stato Target (V35 Ship)
| Metrica | Target | Delta |
|---------|--------|-------|
| Product Score | 75/100 | +43 |
| Commercial Score | 65/100 | +47 |
| UX Score | 78/100 | +50 |
| SaaS Readiness | 70/100 | +46 |
| Play Store Readiness | 90/100 | +45 |
| Security | 85/100 | +50 |

### Verdetto Attuale
- STATUS: ❌ NOT READY
- SUCCESS PROBABILITY: 15%
- MAIN BOTTLENECK: Keystore hardcoded in plaintext nel workflow TWA + RevenueCat mai inizializzato + PDF export mancante + Stripe fake links.
- NEXT MOVE: Rimuovere keystore hardcoded, migrare a GitHub Secrets, implementare PDF export, inizializzare RevenueCat.

---

## 🗂️ INDICE DOCUMENTAZIONE

Questa cartella `docs/v35/` contiene:

| File | Scopo |
|------|-------|
| `00_PLAN_PREVIEW.md` | Questo file — executive summary e indici |
| `01_EXECUTION_PLAN.md` | Piano esecutivo dettagliato con 10 task prioritizzati |
| `02_TECHNICAL_SPEC.md` | Specifica tecnica completa (frontend, mobile, backend, CI/CD) |
| `03_SECURITY_AUDIT.md` | Audit security con fix critici (keystore, secrets, RLS) |
| `04_BUILD_PIPELINE.md` | Pipeline AAB/APK/TWA con fix keystore e ottimizzazioni |
| `05_COMMERCIAL_PLAN.md` | Piano commerciale: pricing, Stripe, RevenueCat, Gumroad |
| `06_GOOGLE_PLAY.md` | Compliance Play Store, asset listing, tester journey |
| `07_BUG_FIXES.md` | Bug catalog: RED/YELLOW/GREEN con soluzioni |
| `08_VERDICT.md` | Verdetto Finale del Consiglio degli Dei |

---

## 🏛️ IL CONSIGLIO DEGLI DEI

### SKY ARCHITECT — Visione prodotto
- **Eliminare:** Tutto ciò che non è OCR→Fattura→PDF→Email→Pagamento
- **Preservare:** Stack Next.js + Expo + Supabase (solido), OCR come wedge
- **Leva massima:** PDF export + Stripe reale = da prototipo a prodotto vendibile

### BEHEMOTH WORLDBREAKER — Distruzione complessità
- 🔥 KILL: Piano Agency (€79/mese) — non esiste, non serve, confonde
- 🔥 KILL: 40+ file markdown di report che descrivono problemi invece di risolverli
- 🔥 KILL: Workflow TWA — duplicato di build-aab, con keystore hardcoded
- ✅ KEEP: Workflow build-aab.yml e build-apk.yml (corretti con Secrets)

### LEVIATAN GATEKEEPER — Audit tecnico
- **Build frontend:** ✅ PASS (tsc + eslint + next build)
- **Build mobile:** ⚠️ PARZIALE (AAB pipeline esiste ma RevenueCat non inizializzato)
- **Backend:** ✅ Supabase con RLS policies
- **CI/CD:** ❌ CRITICO (keystore plaintext in build-twa.yml)
- **Tests:** ⚠️ Playwright configurato ma coverage minima

### SECURITY ARCHITECT — Minaccia
- 🔴 CRITICO: Keystore Base64 hardcoded in .github/workflows/build-twa.yml
- 🔴 CRITICO: Keystore password hardcoded: VelaStorePass2026!
- 🔴 ALTO: Chiavi API Supabase in app.json (pubbliche sul repo)
- 🟡 MEDIO: Nessuna rotazione secrets
- 🟡 MEDIO: RLS policies non verificate su tutte le tabelle

### BILLING ENGINEER — Monetizzazione
- **Prezzo target:** €5/mese (impulse buy per freelancer italiani)
- **Stripe:** Link fake → deve essere real Checkout + Customer Portal
- **RevenueCat:** SDK installato ma MAI inizializzato (Purchases.configure assente)
- **Ritenuta d'acconto:** Calcolata male nel Stripe Checkout (sottratta invece di essere informativa)

### LANDING PAGE CONVERSION ARCHITECT
- **Value proposition confusa:** 8 feature card, 70% fake
- **Social proof falso:** "2.000 freelancer" senza evidenza
- **CTA debole:** "Prova gratis" senza clear next step
- **Fix:** Landing OCR-first: "Fotografa una ricevuta. Fattura pronta in 10 secondi."

### BUG HUNTER OMEGA — Caccia ai bug
Vedi 07_BUG_FIXES.md per catalogo completo. Highlights:
- 🔴 ProUpgrade paywall: acquisto fittizio con setTimeout
- 🔴 Password reset: completamente mancante
- 🔴 FatturaPA/SDI: zero riferimenti (obbligatorio in Italia B2B)
- 🟡 Email conferma: in inglese, sender Supabase (spam-folder)
- 🟡 Organization name auto-generato: "'s Studio"

---

## ⚡ AZIONE IMMEDIATA

### Se puoi fare solo UNA cosa oggi:
Rimuovere il keystore hardcoded da build-twa.yml e ruotare tutte le credenziali. Questo è un rischio di sicurezza critico che invalida ogni altro sforzo.

### Se puoi fare 3 cose:
1. Rimuovere keystore hardcoded + ruotare credenziali
2. Implementare PDF export (tabella stake per app fatturazione)
3. Inizializzare RevenueCat nel mobile (Purchases.configure)

### Se puoi fare 10 cose:
Procedi con il 01_EXECUTION_PLAN.md qui sotto.

---

*Generato da ZIZ — Supreme Build Factory Architect*
*Il grande Ziz detta la legge. Il Consiglio esegue.*
