# OCR-First Redesign Spec

## Principle
The user opens the app and sees ONE thing: **SCAN DOCUMENT**.
Everything else is secondary.

---

## 1. SIDEBAR NAVIGATION REDESIGN

### Current (Broken)
```
📊 Dashboard
📄 Fatture
👥 Clienti
📈 Analytics
⚙️ Impostazioni
🚪 Esci
```

### New (OCR-First)
```
📷 Scanner        (PRIMARY — highlighted)
📄 Fatture
⚙️ Impostazioni
🚪 Esci
```

**Changes:**
- Remove `👥 Clienti` — inline client creation inside invoice form is enough
- Remove `📈 Analytics` — hide until V24
- Add `📷 Scanner` as FIRST item with distinct styling (accent background or border)
- Replace ALL emoji with Lucide icons:
  - `📊` → `LayoutDashboard` (or remove Dashboard entirely)
  - `📄` → `FileText`
  - `👥` → REMOVE
  - `📈` → REMOVE
  - `⚙️` → `Settings`
  - `🚪` → `LogOut`

**File**: `@/frontend/src/app/(dashboard)/layout.tsx:8-14`

---

## 2. DASHBOARD REDESIGN

### Current (Confusing)
- Title: "Dashboard"
- Two competing CTAs: "Importa Documento (OCR)" and "Nuova Fattura"
- KPI cards with emoji icons (💰📄⏳⚠️👥)
- Revenue chart (empty for new users)
- PromoCard (referral banner)
- Quick actions section

### New (OCR-First)

**For New Users (0 invoices):**
```
┌─────────────────────────────────────┐
│                                     │
│    [📷]  Scansiona la tua prima    │
│          ricevuta                  │
│                                     │
│    Carica una foto o PDF.          │
│    L'OCR estrae i dati in          │
│    automatico.                     │
│                                     │
│    [ SCANSIONA ORA ]               │
│                                     │
│    oppure [Crea fattura manuale]   │
│                                     │
└─────────────────────────────────────┘
```

**For Returning Users (>0 invoices):**
```
┌─────────────────────────────────────┐
│  [📷 SCANSIONA DOCUMENTO]  ← primary │
├─────────────────────────────────────┤
│  Ultime fatture (5 most recent)     │
│  • #0042 - Cliente A - €1,200       │
│  • #0041 - Cliente B - €950         │
│  [Vedi tutte →]                     │
├─────────────────────────────────────┤
│  📊 Quick stats (2 cards only)       │
│  Fatture questo mese | Da incassare │
└─────────────────────────────────────┘
```

**Changes:**
- Title: "Dashboard" → "Scanner" or remove title entirely
- Primary CTA: Giant scan button (not two small buttons)
- Remove revenue chart (moved to V24)
- Remove referral banner (kills trust)
- Replace KPI emoji with Lucide icons
- Show recent invoices list directly on dashboard
- "Crea fattura manuale" is a small secondary link, never a competing button

**Files**: `@/frontend/src/app/(dashboard)/dashboard/DashboardView.tsx`

---

## 3. COPY REWRITE — EVERYWHERE

### Landing Page → App Store / Play Store
**Old**: "Fattura. Incassa. Cresci."
**New**: "Fotografa una ricevuta. Ottieni una fattura PDF in 10 secondi."

### Dashboard Title
**Old**: "Dashboard"
**New**: "Scanner" (or no title, just the big scan button)

### Dashboard Subtitle
**Old**: Date string
**New**: "Scansiona una ricevuta o crea una fattura manuale"

### Primary CTA Button
**Old**: "⚡ Importa Documento (OCR)"
**New**: "📷 Scansiona Ricevuta" (with camera icon)

### Secondary Button
**Old**: "✦ Nuova Fattura"
**New**: "+ Nuova Fattura Manuale" (smaller, less prominent)

### Empty State
**Old**: Generic PromoCard with referral
**New**: "Nessuna fattura ancora. Scansiona la tua prima ricevuta per iniziare."

### Scanner Page Title
**Old**: "Importa Documento (OCR)"
**New**: "Scansiona Ricevuta"

### Scanner Page Subtitle
**Old**: "Carica una fattura e lascia che l'OCR estragga i dati per te"
**New**: "Fotografa o carica una ricevuta. L'OCR legge vendor, importo e data."

### OCR Upload Zone Title
**Old**: "Carica Fattura per OCR"
**New**: "Carica la tua ricevuta"

### OCR Upload Zone CTA
**Old**: "Trascina qui la fattura"
**New**: "Trascina qui la ricevuta o clicca per selezionarla"

### Review Form Title
**Old**: "Verifica e Correggi i Dati"
**New**: "Controlla i dati estratti"

### Review Form CTA
**Old**: "Conferma e Salva Fattura"
**New**: "Genera Fattura PDF"

### Skip Button
**Old**: "Salta OCR e inserisci a mano"
**New**: "Inserisci i dati manualmente"

### Success State
**Old**: "Fattura Importata con Successo!"
**New**: "Fattura creata!" + "Scarica PDF" as primary action

### Invoice List Title
**Old**: "Fatture"
**New**: "Le tue fatture"

### Invoice Detail — Download Button
**Old**: "📄 Scarica PDF" (with emoji)
**New**: "Scarica PDF" (with FileDown icon)

---

## 4. SCANNER PAGE AS HOMEPAGE

**Change**: After login, redirect to `/scanner` instead of `/dashboard`.

**Rationale**: The dashboard is empty for new users. The scanner is the action. The scanner IS the dashboard for new users.

**File**: `@/frontend/src/middleware.ts:67` — change redirect from `/dashboard` to `/scanner`
**File**: `@/frontend/src/app/auth/callback/route.ts:5` — add `/scanner` to ALLOWED_REDIRECTS

---

## 5. HIDE / REMOVE NON-OCR PAGES

| Page | Action | Reason |
|------|--------|--------|
| `/analytics` | HIDE from nav | Not core to OCR workflow |
| `/clients` | HIDE from nav | Inline creation is enough |
| Dashboard KPI cards | Simplify to 2 cards | Reduce cognitive load |
| Revenue chart | REMOVE | Empty for new users, confusing |
| Referral banner | REMOVE | Kills trust, interrupts flow |
| PromoCard | REMOVE | Desperate signal |

---

## 6. NEW USER ONBOARDING FLOW

```
Step 1: Signup
  → "Crea il tuo account in 30 secondi"
  → Name, Email, Password, [✓] Accetto i Termini

Step 2: Email Confirmation
  → "Controlla la tua email e clicca il link di conferma"
  → [Reinvia email] [Vai alla login]

Step 3: First Login
  → Redirect to /scanner (not /dashboard)
  → Overlay: "Benvenuto! Scansiona la tua prima ricevuta."
  → Giant scan button is the only thing visible

Step 4: Scan
  → Upload zone is obvious
  → "Carica la tua ricevuta" is clear

Step 5: Review
  → "Controlla i dati estratti" — user knows what to do
  → Fields are color-coded by confidence

Step 6: Generate
  → "Genera Fattura PDF" — clear outcome
  → Success: "Fattura #0042 creata!"
  → Primary action: [Scarica PDF]
  → Secondary: [Scansiona un'altra]
```

---

## 7. MOBILE-SPECIFIC CHANGES

Since this is a Google Play app (implied by Play Store references):

- Scanner page MUST work with camera upload (already works via `<input type="file" accept="image/*">`)
- Add `capture="environment"` to file input for direct camera access
- Ensure upload zone is tap-friendly (min 48px touch targets)
- Mobile sidebar hamburger: replace `☰` with `Menu` Lucide icon
- Mobile header: remove "InvoiceStudio" text, keep only hamburger + page title

**File**: `@/frontend/src/components/ocr/OcrUploadZone.tsx:150-156` — add `capture="environment"`

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
