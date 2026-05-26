# 📘 HANDBOOK DI SVILUPPO & ALLINEAMENTO AGENTI (V12)
> **Progetto:** Invoice Studio
> **Stato Corrente:** V12 (Rilascio OCR + UX Scanner + Limite Giornaliero AdMob)

Questo documento fornisce allineamento strategico, analisi forense dei bug passati e playbooks di prompt per gli agenti specialistici per governare il progetto in sicurezza, ottimizzare le conversioni e garantire la qualità del codice.

---

## 📂 INDICE
1. [Analisi Forense dei Bug & Qualità del Codice](#1-analisi-forense-dei-bug--qualità-del-codice)
   - *Per gli agenti: `@forensic-debugger`, `@code-quality-architect`, `@bug-hunter-omega`, `@context-morph`*
2. [Architettura di Sicurezza & Audit](#2-architettura-di-sicurezza--audit)
   - *Per gli agenti: `@security-architect-reviewer`, `@senior-fullstack-auditor`*
3. [Ingegneria dei Flussi di Cassa & Billing](#3-ingegneria-dei-flussi-di-cassa--billing)
   - *Per gli agenti: `@billing-engineer`*
4. [Ottimizzazione Crescita & Conversione (UX/UI)](#4-ottimizzazione-crescita--conversione-uxui)
   - *Per gli agenti: `@playstore-app-growth-reviewer`, `@landing-page-conversion-architect`, `@seo-audit-architect`*

---

## 1. ANALISI FORENSE DEI BUG & QUALITÀ DEL CODICE
### 🎯 Target: `@forensic-debugger`, `@code-quality-architect`, `@bug-hunter-omega`, `@context-morph`

Nel rilascio della versione V12 si sono verificati errori critici in compilazione che hanno bloccato la pipeline CI/CD. Di seguito sono analizzati i problemi, le soluzioni implementate e i pattern preventivi da seguire rigorosamente.

### 🔍 Caso Studio 1: Errore di compilazione TypeScript in `getUserQuota`
* **Sintomo:** `error TS2739: Type '{ plan: string; ... }' is missing ... dailyRewardedCredits, maxDailyRewardedCredits`.
* **Causa Radice:** L'interfaccia `UserQuota` in `@/frontend/src/lib/plan.ts` era stata estesa con i campi per il rate limiting giornaliero dei rewarded credits (`dailyRewardedCredits`, `maxDailyRewardedCredits`). Tuttavia, nel blocco condizionale dedicato agli utenti con piano **illimitato** (`unlimited: true`), la funzione restituiva una quota mockata priva di tali campi.
* **Risoluzione:** Allineamento rigoroso dell'oggetto di ritorno nel ramo condizionale `quota.unlimited`:
  ```typescript
  if (quota.unlimited) {
    return {
      plan,
      planLimit: Infinity,
      currentMonthInvoices,
      remainingBase: Infinity,
      rewardedCredits: 0,
      maxRewardedCredits: 0,
      dailyRewardedCredits: 0, // Campo riallineato
      maxDailyRewardedCredits: 0,  // Campo riallineato
      canCreateInvoice: true,
      unlimited: true,
      showRewardedAdOption: false,
    };
  }
  ```
* **Regola Preventiva (per `@code-quality-architect`):** Ogni volta che si modifica un'interfaccia centralizzata (specialmente se collegata a logiche di billing, quote o wallet), verificare *tutti* i rami di esecuzione (`unlimited`, `free`, `pro`, `legacy`) per garantire l'allineamento dei tipi, evitando di fare affidamento esclusivo sui default implicit.

### 🔍 Caso Studio 2: Errore Metro Bundler in `useRewardedInvoice.ts`
* **Sintomo:** `SyntaxError: Identifier 'now' has already been declared`.
* **Causa Radice:** All'interno della funzione `refreshQuota` in `@/mobile/lib/useRewardedInvoice.ts`, era presente una variabile globale di funzione `const now = new Date()` (usata all'inizio per calcolare il mese corrente delle fatture). Successivamente, nella sezione aggiunta per calcolare il countdown al reset di mezzanotte, è stata ri-dichiarata `const now = new Date()`.
* **Risoluzione:** Rimossa la ridichiarazione duplicata e riutilizzato lo scope della variabile iniziale:
  ```typescript
  // Time until midnight (local) — riuso `now` già dichiarato sopra
  const midnight = new Date(now);
  ```
* **Regola Preventiva (per `@bug-hunter-omega`):** In JS/TS con compiler moderni, le doppie definizioni nello stesso blocco funzionale (anche se annidate o distanti) causano fallimenti fatali in fase di bundling. Prima di fare un push, verificare la build localmente con `tsc --noEmit` o bundling Metro locale (`npx expo export` o `npm run build` nel frontend).

---

## 2. ARCHITETTURA DI SICUREZZA & AUDIT
### 🎯 Target: `@security-architect-reviewer`, `@senior-fullstack-auditor`

La funzionalità dei rewarded ads sblocca funzionalità di valore (la possibilità di generare fatture oltre il limite gratuito). Questo la rende un vettore ideale di attacco (es. falsificazione delle chiamate di sblocco).

### 🛠️ Sicurezza sul Wallet Unificato (`org_credits`)
1. **RPC Atomica Supabase (`atomic_earn_credit`):**
   - L'accreditamento non avviene mai tramite una query `UPDATE` diretta dal client mobile.
   - Viene invocata una funzione SQL memorizzata (RPC) sul database Supabase che verifica in modo atomico (usando transazioni a livello `SERIALIZABLE` o lock pesanti) se l'`admobCallbackId` è già stato consumato per prevenire attacchi di tipo *Double Spending* o *Replay Attack*.
2. **Rate Limiting nel Database:**
   - La colonna `daily_earned_credits` viene incrementata ad ogni transazione valida.
   - Una policy integrata sul DB (o all'interno dell'RPC) deve bloccare l'incremento se si supera la quota giornaliera di `10`, anche se il client invia un evento AdMob fittizio.

### 🛡️ Playbook di Prompt per l'Agente `@security-architect-reviewer`
> *"Verifica che l'endpoint `/api/rewards/claim` (o l'equivalente RPC Supabase `atomic_earn_credit`) utilizzi le firme AdMob Server-Side Verification (SSV). Controlla se la logica della migrazione SQL in `backend/migration-daily-reward-limit.sql` azzera correttamente `daily_earned_credits` quando `daily_period_date < CURRENT_DATE` all'interno dello stesso blocco atomico transazionale in cui viene accreditato il nuovo credito, per prevenire race conditions."*

---

## 3. INGEGNERIA DEI FLUSSI DI CASSA & BILLING
### 🎯 Target: `@billing-engineer`

Il sistema monetizza convertendo utenti gratuiti in abbonati Pro tramite un paywall (gestito con RevenueCat).

### 🏦 Coesistenza di Limite Gratuito, Crediti Extra & Abbonamenti
1. **Limite Base:** 5 fatture gratuite al mese.
2. **Crediti Extra (Rewarded Ads):** Ogni ad visualizzato e completato garantisce +1 fattura sbloccata. Questo viene modellato come un wallet in cui `effectiveLimit = 5 + (earned_credits - consumed_credits)`.
3. **Limiti di Sicurezza dei Crediti:**
   - Max 10 crediti accumulabili al giorno (`daily_earned_credits`).
   - Soglia massima di accumulo per evitare abuso infinito: `300` crediti nel wallet complessivo.
4. **Modale Limite (`InvoiceLimitModal.tsx`):**
   - Se l'utente raggiunge il limite e ha esaurito i rewarded giornalieri (o totali), l'unica opzione attiva è l'**Upgrade a Pro** a €4.99/mese. Questa è una spinta di conversione strategica formidabile (friction controllata).

### 🛡️ Playbook di Prompt per l'Agente `@billing-engineer`
> *"Analizza l'integrazione di `@/mobile/app/(app)/InvoiceLimitModal.tsx` e `@/mobile/lib/useRewardedInvoice.ts`. Assicurati che lo stato dell'abbonamento attivo letto tramite l'SDK RevenueCat abbia la priorità assoluta su qualsiasi calcolo di quota. Se l'utente è Pro, la modale del limite non deve MAI apparire, e l'accesso alla fotocamera/scanner non deve essere limitato da crediti."*

---

## 4. OTTIMIZZAZIONE CRESCITA & CONVERSIONE (UX/UI)
### 🎯 Target: `@playstore-app-growth-reviewer`, `@landing-page-conversion-architect`, `@seo-audit-architect`

La versione V12 migliora sensibilmente la retention tramite due asset fondamentali: l'OCR e l'esperienza visiva dei limiti.

### 📈 Strategia di Conversione & Engagement
1. **Scanner OCR (Tesseract.js in Backend):**
   - L'utente scansiona una ricevuta cartacea. Invece di richiedere l'inserimento manuale o mostrare uno spinner statico indefinito, l'applicazione mostra una barra di avanzamento dello stato dell'analisi, seguita da una scheda con i dati pre-compilati (Fornitore, Data, Totale) pronti per essere confermati.
   - *Valore di crescita:* Diminuisce drasticamente il tasso di abbandono (churn) durante la creazione manuale delle fatture.
2. **Esperienza Visiva del Countdown e Progresso:**
   - Inserire una barra di progresso visiva per i crediti giornalieri (`X/10 oggi`) aumenta la consapevolezza del valore del servizio e gamifica l'interazione quotidiana.
   - Quando il limite di 10 crediti viene raggiunto, il pulsante viene disattivato mostrando il countdown esatto per il reset (es. "Reset in 14h 32m"). Questo crea un effetto *F.O.M.O.* controllato e incoraggia l'utente a valutare l'abbonamento Pro per eliminare l'attesa.

### 🛡️ Playbook di Prompt per l'Agente `@landing-page-conversion-architect`
> *"Ottimizza il copy e il layout visivo della modale in `@/mobile/app/(app)/InvoiceLimitModal.tsx`. Suggerisci modifiche estetiche per rendere il piano Pro molto più attraente rispetto al video promozionale (es. evidenziando i vantaggi in termini di tempo risparmiato con l'OCR illimitato rispetto alla visualizzazione forzata di 10 video al giorno)."*
