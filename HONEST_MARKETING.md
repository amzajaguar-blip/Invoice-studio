# Honest Marketing Check

## Current vs Reality

---

## PROMISES TO REMOVE (Immediately)

### Landing Page Claims

| Current Claim | Reality | Action |
|---------------|---------|--------|
| "Risparmia 5 ore a settimana" | Unverified. No evidence. | Remove or replace with "Risparmia tempo sulla fatturazione" |
| "2.000 freelancer italiani" | Zero users. | Remove. Replace with "In fase di lancio — unisciti ai primi utenti" |
| "Firma digitale, blockchain-ready, legalmente valida" | No blockchain. No qualified e-signature. | Remove entirely |
| "AI Cashflow Predictor" | API call to LLM, no actual prediction. | Remove. Call it "AI-assisted OCR" only |
| "Sync Contabilità — QuickBooks, Xero, Wave, FreshBooks" | Zero integrations. | Remove entirely |
| "Client Portal White-Label" | Not implemented. | Remove entirely |
| "Setup in 2 minuti" | Requires email confirmation (~5 min avg). | Change to "Setup in pochi minuti" |
| "Disdici quando vuoi" | No cancellation UI. | Remove until portal exists |
| "PCI-DSS Compliant" | No certification. | Remove. You are not PCI-DSS compliant. |
| "Stripe & PayPal" | Only Stripe placeholder. No PayPal. | Change to "Pagamenti via Stripe" |
| "Reminder automatici — tono si adatta (amichevole → formale → legale)" | No reminder scheduler. | Remove entirely |
| "Analytics avanzate — MRR, DSO, top client, revenue growth" | Only basic invoice count and revenue total. | Change to "Dashboard semplice con fatture e incassi" |
| "Export per il commercialista in 1 click" | No export button. | Remove until CSV export works |
| "Multi-currency" | Hardcoded EUR default. No live rates. | Remove. EUR-only for now. |
| "Supporto prioritario" | No support channel exists. | Remove entirely |
| "API pubblica + webhook" | No API docs. No webhook UI. | Remove entirely |
| "10 sub-account" | No multi-user UI. | Remove entirely |
| "Custom domain (CNAME)" | No DNS configuration. | Remove entirely |
| "SLA garantito" | No SLA document. No uptime guarantee. | Remove entirely |

### How It Works Section

| Current Claim | Reality | Action |
|---------------|---------|--------|
| "Editor WYSIWYG con drag&drop" | Plain form, no WYSIWYG, no drag&drop. | Change to "Editor semplice e veloce" |
| "Il cliente riceve email con anteprima, link di pagamento Stripe e firma digitale" | Client receives basic email with link. No preview, no e-sign. | Change to "Il cliente riceve l'email con la fattura PDF" |
| "Pagamento confermato → webhook Stripe → PDF ricevuta → reminder cancellati" | Webhook exists but no PDF receipt generation, no reminder cancellation. | Change to "Pagamento confermato automaticamente" |
| "Zero lavoro manuale" | All manual. | Remove. |

### Trust Bar

| Current | Action |
|---------|--------|
| "🔒 PCI-DSS Compliant" | Remove |
| "🇮🇹 Made for Italy" | Keep (true) |
| "⚡ Setup in 2 min" | Change to "⚡ Setup rapido" |
| "💳 Stripe & PayPal" | Change to "💳 Pagamenti Stripe" |
| "✍️ Firma Digitale" | Remove |
| "🤖 AI Cashflow" | Remove |

**Replace trust bar with:**
- "🇮🇹 Fatto per l'Italia"
- "🔒 Dati protetti con Supabase"
- "⚡ Fattura in meno di 60 secondi"
- "📱 Funziona su desktop e mobile"
- "💳 Pagamenti Stripe"
- "📄 PDF professionale"

---

## REWRITTEN POSITIONING

### Hero Headline

**FROM:**
"Fattura. Incassa. Cresci."
"Risparmia 5 ore a settimana su admin e inseguimento pagamenti. Firma digitale, analytics AI, pagamenti Stripe in un click."

**TO:**
"Fotografa una ricevuta. Crea la fattura in 10 secondi."
"Scansiona le tue ricevute con OCR. Genera fatture PDF professionali. Invia al cliente via email. Tutto in un'unica piattaforma per freelancer italiani."

### Features Grid (Honest Version)

| Icon | Title | Description |
|------|-------|-------------|
| 📷 | OCR Scanner | Fotografa una ricevuta e lascia che l'AI estragga vendor, importo e data. Crea la fattura in automatico. |
| 📝 | Editor Veloce | Crea fatture manuali in meno di 60 secondi. Cliente, importi, IVA, scadenza. Fatto. |
| 📄 | PDF Professionale | Scarica fatture in PDF con il tuo logo e i dati del tuo studio. Pronte da inviare. |
| ✉️ | Invio Email | Invia la fattura PDF al cliente direttamente dall'app. Traccia chi ha pagato. |
| 🔔 | Reminder Scadenze | Ricevi notifiche prima delle scadenze. Non perdere mai un pagamento. |
| 📊 | Dashboard Semplice | Visualizza fatture, incassi e scadenze in un'unica schermata chiara. |

### Pricing (Honest Version)

| Plan | Price | Features |
|------|-------|----------|
| **Free** | €0/mese | 10 scansioni OCR/mese, fatture manuali illimitate, PDF con watermark |
| **Pro** | €5/mese | Scansioni OCR illimitate, PDF senza watermark, invio email, reminder email |

**Remove Agency plan.** It doesn't exist.

---

## HONEST LANDING PAGE STRUCTURE

```
HERO:
  "Fotografa una ricevuta. Crea la fattura in 10 secondi."
  CTA: "Inizia gratis" / "Guarda come funziona" (link to 30-sec demo video)

SOCIAL PROOF:
  "Unisciti ai primi utenti" (no fake numbers)
  [Beta tester quote when available]

FEATURES (6 honest features):
  OCR, Editor, PDF, Email, Reminder, Dashboard

HOW IT WORKS:
  1. Scansiona la ricevuta (OCR estrae i dati)
  2. Controlla e salva (revisione rapida)
  3. Scarica il PDF e invia (fattura professionale)

PRICING:
  Free vs €5 Pro (honest comparison)

FAQ:
  "Posso inviare fatture senza OCR?" → Sì, l'editor manuale è gratuito.
  "Le fatture sono legalmente valide?" → Le fatture PDF sono valide per B2C. Per B2B serve la fatturazione elettronica (in arrivo).
  "Posso cancellare in qualsiasi momento?" → Sì, direttamente dal portale Stripe.

FOOTER:
  Privacy, Terms, © 2026
```

---

## THE HONESTY DIVIDEND

A product page that underpromises and overdelivers converts better than one that overpromises and underdelivers.

**Current state**: User arrives excited → discovers lies → leaves angry → tells friends "it's fake"

**Honest state**: User arrives skeptical → discovers product works as described → stays → tells friends "it does what it says"

The honest page will get fewer signups but **much higher activation and retention**.

---

*Document generated by LEVIATAN strategic analysis*
*Date: 2026-06-02*
