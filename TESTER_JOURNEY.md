# Tester Journey — First 5 Minutes Audit

## Tester Profile
Google Play tester. Italian freelancer. Never used the app. No prior knowledge. Will abandon at first confusion.

---

## JOURNEY STEP 1: App Install & Open

| Checkpoint | Status | Issue |
|------------|--------|-------|
| App icon visible | OK | — |
| App name correct | OK | "InvoiceStudio" |
| App opens without crash | OK | — |
| **First screen is clear** | **FAIL** | If landing page shown in webview, it's overwhelming. If redirected to login immediately, OK. |

**Friction**: If app opens to landing page, tester sees 8 feature cards (70% fake) → confusion.
**Fix**: Open directly to `/login` or `/scanner` if authenticated.

---

## JOURNEY STEP 2: Signup

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Signup form visible | OK | `@/frontend/src/app/(auth)/signup/page.tsx` |
| Fields clear | PARTIAL | No labels explanation. "Nome completo" — is this my name or business name? |
| Password requirements shown | OK | "Almeno 10 caratteri" placeholder |
| Terms acceptance | **FAIL** | No checkbox. No links to Terms/Privacy. |
| Error messages in Italian | **FAIL** | Raw Supabase errors. |
| Success message | OK | Redirects to login with "Account creato!" message |
| **Resend email option** | **FAIL** | No "Non ho ricevuto l'email" link. |

**Friction Points:**
1. User doesn't know if "Nome completo" should be personal or business name
2. User creates account, misses email, has NO WAY to resend
3. User sees English error if email already exists: "User already registered"

**Fixes Needed:**
- Add hint: "Il tuo nome personale"
- Add Terms checkbox with links
- Add `translateSignupError()` function
- Add resend link on login page

---

## JOURNEY STEP 3: Email Confirmation

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Email arrives | OK | Supabase default |
| Sender name | **FAIL** | From "noreply@...supabase.co" — looks like spam |
| Subject line | OK | "Confirm your signup" (English!) |
| Email content | **FAIL** | English. No branding. |
| Confirmation link works | OK | `@/frontend/src/app/auth/callback/route.ts` |
| **Error if link expired** | **FAIL** | Silent redirect to login with no explanation |

**Friction Points:**
1. Email in English screams "not Italian product"
2. Supabase domain looks untrustworthy
3. Expired link = dead end with no error message

**Fixes Needed:**
- Configure custom SMTP (Resend/Postmark) with Italian sender name
- Override Supabase email templates to Italian
- Add error handling for expired links: `login?error=expired`

---

## JOURNEY STEP 4: First Login

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Login form works | OK | — |
| "Just signed up" banner | OK | Green success message shown |
| Redirect after login | OK | Goes to dashboard |
| **Dashboard for new user** | **FAIL** | Empty. No guidance. No "what do I do now?" |

**Friction Points:**
1. Dashboard shows "0 fatture", empty chart, generic promo → "What now?"
2. Two buttons compete: "Importa Documento" and "Nuova Fattura"
3. No onboarding wizard, no tooltip, no "Start here"

**Fixes Needed:**
- Redirect new users to `/scanner` directly
- Show overlay: "Benvenuto! Scansiona la tua prima ricevuta."
- Make scanner the homepage

---

## JOURNEY STEP 5: First Scan (OCR)

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Scanner page accessible | OK | `/scanner` exists |
| Upload zone clear | PARTIAL | "Trascina qui la fattura" — should say "ricevuta" |
| Mobile camera access | PARTIAL | No `capture="environment"` attribute |
| File type validation | OK | Shows error for unsupported formats |
| File size validation | OK | Max 20MB |
| PDF conversion | OK | Works for PDF files |
| OCR processing | OK | API call works |
| Confidence scores shown | OK | Color-coded |

**Friction Points:**
1. "Fattura" vs "Ricevuta" terminology confusion
2. On mobile, must tap "choose file" instead of direct camera
3. No guidance on what makes a good scan (lighting, alignment)

**Fixes Needed:**
- Change all "fattura" to "ricevuta" in scanner context
- Add `capture="environment"` to file input
- Add tooltip: "Assicurati che il testo sia leggibile e ben illuminato"

---

## JOURNEY STEP 6: Review Extracted Data

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Document preview visible | OK | Left column shows image |
| Fields editable | OK | All fields are editable |
| Confidence colors clear | OK | Green/Yellow/Red |
| Empty fields highlighted | OK | Red border |
| **Field labels** | **PARTIAL** | "Imponibile" might confuse non-accountants |
| **Skip option** | OK | "Salta OCR e inserisci a mano" |

**Friction Points:**
1. "Imponibile" — freelancer may not know this term
2. No explanation of what to do: "Should I edit everything? Just the red ones?"

**Fixes Needed:**
- Add helper text: "Modifica i campi evidenziati in rosso. Gli altri sono corretti."
- Consider renaming "Imponibile" to "Importo (senza IVA)" for clarity

---

## JOURNEY STEP 7: Save Invoice

| Checkpoint | Status | Issue |
|------------|--------|-------|
| "Conferma e Salva" button | OK | Works |
| Loading state | OK | Spinner shown |
| Success screen | PARTIAL | "Fattura Importata con Successo!" — imported FROM what? |
| **Next action clear** | **FAIL** | "Vai alle fatture" is secondary. No "Download PDF" shown. |
| Invoice ID shown | OK | ID visible |

**Friction Points:**
1. Success message is generic
2. Primary action should be "Download PDF" but it's hidden in invoice list
3. No celebration, no "You did it!" moment

**Fixes Needed:**
- Success: "Fattura #0042 creata!" 
- Primary CTA: [Scarica PDF]
- Secondary: [Scansiona un'altra]
- Add confetti or success animation

---

## JOURNEY STEP 8: Download PDF

| Checkpoint | Status | Issue |
|------------|--------|-------|
| PDF download button | **FAIL** | Link exists but route `/api/invoices/{id}/pdf` likely doesn't generate PDF |
| PDF quality | **FAIL** | No PDF generation code found in codebase |
| Business info on PDF | **FAIL** | Missing |

**Friction Points:**
1. Tester clicks "Scarica PDF" → gets 404 or blank page → app is broken
2. This is the most critical failure — the core output doesn't exist

**Fixes Needed:**
- Build PDF generation with `@react-pdf/renderer`
- Include business info (name, VAT, address)
- Test end-to-end before submission

---

## JOURNEY STEP 9: Send Invoice Email

| Checkpoint | Status | Issue |
|------------|--------|-------|
| Email send button | OK | Exists in detail panel |
| Email preview | **FAIL** | No preview before send |
| Email delivery | PARTIAL | Uses API but SMTP may be unconfigured (spam risk) |
| Success confirmation | OK | "✓ Email inviata al cliente" |

**Friction Points:**
1. User is terrified of sending wrong email to client
2. No preview = no trust

**Fixes Needed:**
- Add email preview modal (V24, not V23 blocker)
- Configure SMTP so emails actually arrive

---

## JOURNEY STEP 10: Password Reset (Edge Case)

| Checkpoint | Status | Issue |
|------------|--------|-------|
| "Forgot password?" link | **FAIL** | Does not exist |
| Reset flow | **FAIL** | No pages, no API |

**Impact**: Tester who forgets password = permanent churn. Google Play reviews will mention this.

**Fix**: Build complete password reset flow (highest auth priority).

---

## CONFUSION MAP

| Step | Confusion Level | Cause |
|------|-----------------|-------|
| Signup | Medium | No terms, unclear field purpose |
| Email Confirmation | High | English email, spam-looking sender |
| First Login | **CRITICAL** | Empty dashboard, no guidance |
| Scanner | Medium | "Fattura" vs "Ricevuta" |
| Review | Medium | Unfamiliar accounting terms |
| Success | Medium | Unclear next action |
| PDF Download | **CRITICAL** | Button exists but doesn't work |
| Send Email | Medium | No preview, fear of mistake |

---

## DEAD ENDS

1. **No resend confirmation email** → user stuck forever
2. **No password reset** → user locked out forever
3. **PDF button that doesn't work** → user thinks app is broken
4. **Expired confirmation link** → silent redirect, no error
5. **"Clients" page empty** → user thinks they MUST create clients first
6. **Settings tabs "Coming Soon"** → user loses trust

---

## FIX PRIORITY FOR TESTER SUCCESS

| Priority | Fix | Tester Impact |
|----------|-----|---------------|
| 1 | Build PDF generation | **CRITICAL** — core output missing |
| 2 | Add password reset | **CRITICAL** — basic auth missing |
| 3 | Redirect new users to scanner | **HIGH** — empty dashboard kills activation |
| 4 | Remove/replace all emoji | **HIGH** — looks unprofessional |
| 5 | Add resend confirmation | **HIGH** — recovery from missed email |
| 6 | Fix auth callback error handling | **MEDIUM** — expired link dead end |
| 7 | Change scanner copy to "ricevuta" | **MEDIUM** — terminology confusion |
| 8 | Add camera capture attribute | **MEDIUM** — mobile UX |
| 9 | Add scan quality tips | **LOW** — reduces OCR failures |
| 10 | Add confetti on first invoice | **LOW** — delight moment |

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
