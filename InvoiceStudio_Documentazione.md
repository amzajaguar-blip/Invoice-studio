# InvoiceStudio — Documentazione Prodotto v1.0

> **Fatture professionali + pagamento diretto per freelancer e agenzie**

---

## 📋 Indice

1. [Panoramica Prodotto](#panoramica)
2. [Funzionalità Core](#funzionalità)
3. [Architettura Tecnica](#architettura)
4. [Modello di Monetizzazione](#monetizzazione)
5. [Piano di Sviluppo (Roadmap)](#roadmap)
6. [Integrazioni Esterne](#integrazioni)
7. [Metriche di Successo (KPI)](#kpi)
8. [Miglioramenti Proposti](#miglioramenti)

---

## 1. Panoramica Prodotto {#panoramica}

### Il Problema

Freelancer e agenzie perdono in media **3-5 ore/settimana** su attività amministrative:

- Creazione manuale di fatture (spesso in Word o Google Docs)
- Rincorrere pagamenti in ritardo (media italiana: 37 giorni vs 30 pattuiti)
- Riconciliazione manuale in Excel per il commercialista
- Clienti che procrastinano perché il pagamento richiede IBAN + bonifico

### La Soluzione

InvoiceStudio è una piattaforma SaaS che comprime il ciclo **fattura → pagamento** da settimane a ore, tramite:

- Template professionali con branding personalizzabile
- Link di pagamento diretto incorporato (Stripe / PayPal)
- Tracking in tempo reale (aperta? pagata? scaduta?)
- Automazione reminder e report per il commercialista

### Utente Target

| Segmento | Dimensione IT | Dolore Principale |
|----------|---------------|-------------------|
| Freelancer (design, dev, copy) | ~1.2M | Admin time, pagamenti lenti |
| Agenzie small (<10 persone) | ~180K | Multi-cliente, white-label |
| Professionisti (avvocati, consulenti) | ~450K | Compliance, fattura elettronica |

---

## 2. Funzionalità Core {#funzionalità}

### 2.1 Invoice Builder

- **Template library**: 15+ template professionali (Minimal, Corporate, Creative, Legal)
- **Branding kit**: Logo upload, palette colori, font personalizzati
- **Campi smart**: Calcolo automatico IVA, ritenuta d'acconto, sconti
- **Multi-lingua**: IT / EN / FR / DE per clienti internazionali
- **Preventivi → Fattura**: Conversione in 1 click con storico versioni

### 2.2 Pagamento Diretto

- **Link embed**: Bottone "Paga Ora" incorporato in ogni fattura (PDF + web view)
- **Gateway supportati**: Stripe (carte), PayPal, SEPA Direct Debit, Satispay (roadmap)
- **Checkout**: Ottimizzato mobile, 3 campi massimo, < 10 secondi
- **Conferma automatica**: Email + PDF ricevuta a cliente e fornitore

### 2.3 Tracking & Analytics

- **Status fattura**: Bozza → Inviata → Aperta → Pagata → In ritardo
- **Read receipts**: Timestamp apertura email e PDF view
- **Dashboard revenue**: MRR, outstanding, tempo medio pagamento
- **Alert real-time**: Notifica push/email a ogni cambio status

### 2.4 Automazione Reminder

- **Sequenza pre-scadenza**: Reminder a 7gg e 1gg dalla deadline
- **Sequenza post-scadenza**: Follow-up a +1gg, +7gg, +30gg (tono escalante)
- **Personalizzazione**: Template email modificabili, invio da dominio custom
- **Pausa automatica**: Stop reminder a pagamento avvenuto

### 2.5 Export & Compliance

- **Bulk CSV**: Export filtrato per periodo, cliente, status — pronto per commercialista
- **PDF archivio**: Download batch fatture in ZIP
- **Fattura elettronica SDI** (roadmap v2): Generazione XML FatturaPA
- **Multi-currency**: EUR, USD, GBP, CHF con tasso di cambio live (ECB API)

---

## 3. Architettura Tecnica {#architettura}

### Stack Tecnologico

```
Frontend:    Next.js 14 (App Router) + TypeScript
Styling:     Tailwind CSS + shadcn/ui
Backend:     Next.js API Routes + Supabase Edge Functions
Database:    Supabase (PostgreSQL) + Row Level Security
Auth:        Supabase Auth (email, Google OAuth)
Pagamenti:   Stripe Connect + PayPal SDK
Storage:     Supabase Storage (PDF, loghi)
Email:       Resend API (transazionale) + React Email templates
PDF:         @react-pdf/renderer
Deploy:      Vercel (frontend) + Supabase (backend)
```

### Schema Database (core)

```sql
-- Organizzazioni (multi-tenant)
organizations (id, name, logo_url, brand_color, stripe_account_id, plan)

-- Clienti
clients (id, org_id, name, email, vat_number, address, currency)

-- Fatture
invoices (id, org_id, client_id, number, status, issue_date, due_date,
          subtotal, tax_rate, total, currency, payment_link, paid_at)

-- Righe fattura
invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate)

-- Tracking eventi
invoice_events (id, invoice_id, event_type, metadata, created_at)

-- Reminder schedulati
reminders (id, invoice_id, send_at, sent_at, template_id, status)
```

### Flusso Pagamento

```
1. Freelancer crea fattura → sistema genera Stripe PaymentIntent
2. PDF generato con link embed → /pay/{invoice_token}
3. Cliente apre link → Stripe Checkout (hosted o custom)
4. Webhook Stripe → invoice.status = 'paid', paid_at = now()
5. Email conferma → cliente + freelancer
6. Reminder sequenza → cancellata automaticamente
```

---

## 4. Modello di Monetizzazione {#monetizzazione}

### Piani Sottoscrizione

| Piano | Prezzo | Limiti | Target |
|-------|--------|--------|--------|
| **Free** | €0/mese | 5 fatture/mese, template basic | Prova / micro-freelancer |
| **Pro** | €19/mese | Illimitate, tutti template, reminder, multi-currency | Freelancer attivi |
| **Agency** | €79/mese | 10 sub-account, white-label, API, priority support | Agenzie / studi |
| **Enterprise** | Custom | Unlimited accounts, SSO, SLA, fattura elettronica | Aziende >50 persone |

### Revenue Streams Aggiuntivi

**1. Affiliate pagamenti (Payment Facilitation)**
- Stripe Connect: commissione Stripe standard (1.5% + €0.25 EU) → si trattiene 0.5%
- Esempio: €100K/mese processato → €500/mese passivo
- Scalabile linearmente con volume transazioni

**2. B2B API**
- Endpoint REST per generazione fatture white-label
- Target: software contabilità, ERP, gestionali
- Pricing: €500/mese (starter, 1K call) → €5.000/mese (enterprise, unlimited)

**3. Template Marketplace (roadmap v3)**
- Designer vendono template premium: 70% creator / 30% piattaforma
- Prezzo template: €5-25 una tantum

### Unit Economics (proiezione 18 mesi)

```
Target: 500 Pro + 50 Agency = €13.450 MRR
Con payment affiliate (€500K/mese vol.): +€2.500 MRR
Con 3 clienti B2B API: +€3.000 MRR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Totale MRR proiettato (18 mesi): ~€18.950
ARR: ~€227.000
```

---

## 5. Roadmap di Sviluppo {#roadmap}

### v1.0 — MVP (0-3 mesi)
- [ ] Invoice builder con 5 template
- [ ] Integrazione Stripe pagamenti
- [ ] Tracking status base (inviata/pagata)
- [ ] Email reminder manuale
- [ ] Export CSV
- [ ] Auth + multi-tenant base

### v1.5 — Growth (3-6 mesi)
- [ ] Reminder automatici (7gg, 1gg, post-scadenza)
- [ ] Dashboard analytics (revenue, outstanding, DSO)
- [ ] PayPal integration
- [ ] Template branding completo (logo, colori)
- [ ] Mobile app (React Native o PWA)

### v2.0 — Scala (6-12 mesi)
- [ ] Fattura elettronica SDI (XML FatturaPA)
- [ ] Preventivi + contratti digitali (firma elettronica)
- [ ] Sub-account Agency con white-label
- [ ] API pubblica + webhook
- [ ] Satispay integration
- [ ] Integrazione Xero / QuickBooks

### v3.0 — Platform (12-18 mesi)
- [ ] Template marketplace
- [ ] Ricevute spese + nota spese
- [ ] Multi-entità (più P.IVA per stesso account)
- [ ] AI: suggerimento testo fattura, rilevamento anomalie pagamento
- [ ] Integrazione bancaria (Open Banking PSD2)

---

## 6. Integrazioni Esterne {#integrazioni}

| Categoria | Strumento | Scopo | Priorità |
|-----------|-----------|-------|----------|
| Pagamenti | Stripe Connect | Gateway principale, affiliate | P0 |
| Pagamenti | PayPal | Alternativa per clienti internazionali | P1 |
| Email | Resend | Transazionale, reminder | P0 |
| Cambio valute | ECB API | Tasso EUR live | P1 |
| PDF | React PDF | Generazione server-side | P0 |
| Contabilità | Xero API | Sync automatico fatture | P2 |
| Contabilità | QuickBooks | Mercato US/UK | P2 |
| Firma | DocuSign / Yousign | Contratti digitali | P2 |
| Banca | Nordigen (GoCardless) | Riconciliazione bancaria | P3 |

---

## 7. Metriche di Successo (KPI) {#kpi}

### Prodotto
- **Activation rate**: % utenti che creano prima fattura entro 48h (target: >60%)
- **Time to first invoice**: Minuti dal signup alla prima fattura inviata (target: <10 min)
- **Payment conversion**: % fatture pagate tramite link diretto (target: >40%)
- **DSO reduction**: Giorni medi pagamento prima vs dopo InvoiceStudio (target: -50%)

### Business
- **MRR growth**: +15% MoM per i primi 12 mesi
- **Churn rate**: <3% mensile (benchmark SaaS B2SMB)
- **LTV/CAC ratio**: >3x a 12 mesi
- **NPS**: >50 (promotori attivi = growth organico)

### Tecnico
- **Uptime**: 99.9% (SLA Pro/Agency)
- **PDF generation**: <2 secondi
- **Webhook reliability**: >99.5% (pagamenti)

---

## 8. Miglioramenti Proposti {#miglioramenti}

Questa sezione raccoglie i miglioramenti identificati per le iterazioni future del prodotto.

### 🔴 Priorità Alta (impatto diretto su revenue/retention)

**M-001: Fattura Elettronica SDI Nativa**
- *Problema*: Il mercato italiano richiede FatturaPA dal 2019. Assenza = blocco per il 60% dei professionisti con P.IVA.
- *Soluzione*: Integrazione con Aruba/InfoCert per invio diretto a SDI. Generazione XML automatica dai dati fattura.
- *Impatto stimato*: +35% conversione utenti IT, upsell naturale a piano Pro.
- *Effort*: Alto (6-8 settimane). Partner API: Fattura24 o Invoicex.

**M-002: Stripe Connect Express per Onboarding Veloce**
- *Problema*: Onboarding pagamenti attuale richiede molti passaggi. Ogni attrito riduce activation.
- *Soluzione*: Stripe Connect Express con KYC delegato a Stripe. Utente operativo in <5 minuti.
- *Impatto*: +20% activation rate, riduzione support tickets.
- *Effort*: Medio (2-3 settimane).

**M-003: Ricorrenza Automatica (Abbonamenti)**
- *Problema*: Molti freelancer hanno clienti con retainer mensile fisso.
- *Soluzione*: Fatture ricorrenti con generazione automatica (settimanale/mensile/annuale) + addebito automatico Stripe.
- *Impatto*: Forte retention — chi imposta ricorrenze non abbandona mai.
- *Effort*: Medio (3-4 settimane).

### 🟡 Priorità Media (differenziazione competitiva)

**M-004: Client Portal**
- *Problema*: Il cliente riceve solo email. Nessun posto dove vedere tutte le fatture, scaricare PDF, pagare arretrati.
- *Soluzione*: Portal web dedicato per cliente (login via magic link) con storico fatture e pagamento in batch.
- *Impatto*: Riduzione email di supporto, aumento pagamenti multipli.
- *Effort*: Medio-alto (4-5 settimane).

**M-005: AI Invoice Assistant**
- *Problema*: Utenti perdono tempo a descrivere le voci di fattura in modo professionale.
- *Soluzione*: Campo "Descrivi il lavoro fatto" → AI genera descrizione fattura professionale + suggerisce tariffa basata su storico.
- *Impatto*: Differenziazione wow-factor, viralità (screenshot shareable).
- *Effort*: Basso (1-2 settimane con Claude API).

**M-006: Integrazione Calendario (Time Tracking Leggero)**
- *Problema*: I freelancer tracciano le ore in Toggl/Clockify, poi trasferiscono manualmente in fattura.
- *Soluzione*: Import da Toggl/Harvest/Clockify → righe fattura precompilate con ore e tariffe.
- *Impatto*: Elimina doppio lavoro, sticky per utenti con billing orario.
- *Effort*: Medio (3-4 settimane per 2 integrazioni).

### 🟢 Priorità Bassa (nice-to-have / roadmap lunga)

**M-007: App Mobile Nativa (iOS/Android)**
- *Problema*: Freelancer spesso in mobilità, necessità di creare fatture velocemente da telefono.
- *Soluzione*: React Native app con camera scan per ricevute + creazione fattura rapida.
- *Effort*: Alto (8-12 settimane).

**M-008: Firma Elettronica Integrata**
- *Problema*: Preventivi richiedono firma separata (DocuSign a parte, costoso).
- *Soluzione*: Firma elettronica semplice integrata per preventivi e contratti (qualificata via partner).
- *Effort*: Medio-alto. Partner: Yousign (EU-friendly, API ottima).

**M-009: Multi-Entità (più P.IVA)**
- *Problema*: Alcuni freelancer hanno 2 entità fiscali (es. individuale + SRL).
- *Soluzione*: Possibilità di gestire più "profili aziendali" con billing separato dallo stesso account.
- *Effort*: Alto (refactor schema database).

**M-010: Open Banking — Riconciliazione Automatica**
- *Problema*: Anche con reminder, i bonifici IBAN richiedono riconciliazione manuale.
- *Soluzione*: Connessione bancaria via PSD2 (Nordigen/GoCardless) per match automatico bonifici → fatture.
- *Impatto*: Elimina completamente il lavoro del commercialista per utenti Pro.
- *Effort*: Alto. Compliance PSD2 richiede SCA handling.

---

## Appendice: Analisi Competitiva

| Feature | InvoiceStudio | Fattura24 | Invoicely | FreshBooks |
|---------|--------------|-----------|-----------|------------|
| Pagamento diretto embed | ✅ | ❌ | ✅ | ✅ |
| Fattura elettronica IT | 🗺️ v2 | ✅ | ❌ | ❌ |
| White-label Agency | ✅ | ❌ | ❌ | ❌ |
| Reminder automatici | ✅ | ❌ | ✅ parziale | ✅ |
| AI assistant | 🗺️ v2 | ❌ | ❌ | ❌ |
| Prezzo entry | €0 | €8/mese | €0 | €15/mese |
| Multi-currency | ✅ | ❌ | ✅ | ✅ |

**Vantaggio competitivo principale**: Unica piattaforma che combina UX moderna + pagamento diretto embed + white-label Agency nel mercato italiano a questo prezzo.

---

*Documento generato: Maggio 2026 — InvoiceStudio v1.0*
*Prossima revisione: dopo chiusura MVP (fine Q3 2026)*
