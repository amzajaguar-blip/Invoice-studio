# Implementation Plan: VELA Pivot Prodotto

## Overview

Implementazione del pivot da "generatore di fatture PDF" a "quaderno del professionista" per la app VELA (React Native/Expo/TypeScript). Il piano segue l'ordine delle dipendenze: fondamenta tipologiche e DB → moduli core (IAP, PDF, Excel, Notifiche) → sezioni UI → navigazione → naming → test.

**Vincoli critici globali (validi per ogni task)**:
- Nessuna modifica a `Rate_Limit_Engine`, `PlanContext`, `organizations.plan`, `user_plan.plan`
- `generateInvoicePDF` e `shareInvoicePDF` non vengono mai modificati
- `iap-engine.ts` non deve importare da `rate-limit-engine.ts` o `PlanContext.tsx`
- Nessun rate-limit in nessuna forma su nessuna sezione

---

## Tasks

- [x] 1. Fondamenta — Tipi TypeScript condivisi e migrazioni Supabase
  - [x] 1.1 Estendere `shared/types.ts` con i nuovi tipi condivisi
    - Aggiungere `QuoteStatus`, `ReminderRecurrence`, `ClientSnapshot`, `Quote`, `ExpenseItem`, `ExpenseReport`, `Reminder` al file `shared/types.ts`
    - I tipi `Invoice`, `Client`, `LineItem`, `InvoiceStatus` e tutti gli esistenti NON vengono modificati
    - `ClientSnapshot` include: `id`, `name`, `email?`, `phone?`, `address?`, `taxId?`, `currency`
    - `Quote` riusa `LineItem` esistente; include `convertedToInvoiceId?: string`
    - _Requirements: 4.6, 5.1, 6.1, 7.3, 14.7_

  - [x] 1.2 Creare migrazione Supabase per tabella `quotes`
    - File: `supabase/migrations/20250800000001_pivot_quotes.sql`
    - Schema completo con `org_id`, `client_snapshot JSONB`, `line_items JSONB`, stati `draft|sent|accepted|rejected|invoiced`
    - RLS policy `quotes_org_owner` con pattern `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
    - Trigger `trg_quotes_updated_at` che riutilizza `public.update_updated_at()` esistente
    - FK `client_id REFERENCES public.clients(id) ON DELETE SET NULL`
    - FK `converted_to_invoice_id REFERENCES public.invoices(id) ON DELETE SET NULL`
    - Vincolo critico: nessuna modifica a `organizations.plan` o `user_plan.plan`
    - _Requirements: 4.6, 1.1_

  - [x] 1.3 Creare migrazione Supabase per tabella `expenses`
    - File: `supabase/migrations/20250800000002_pivot_expenses.sql`
    - Schema: `id`, `org_id`, `report_number`, `title`, `period_from`, `period_to`, `items JSONB`, `total_by_category JSONB`, `grand_total`, `currency`
    - RLS policy e trigger `updated_at` con stesso pattern di 1.2
    - Vincolo critico: nessuna modifica a `organizations.plan` o `user_plan.plan`
    - _Requirements: 5.1, 1.1_

  - [x] 1.4 Creare migrazione Supabase per tabella `reminders`
    - File: `supabase/migrations/20250800000003_pivot_reminders.sql`
    - Schema: `id`, `org_id`, `title`, `notes`, `due_date TIMESTAMPTZ`, `recurrence CHECK('once','monthly','yearly')`, `notification_id`, `completed BOOLEAN DEFAULT false`
    - RLS policy e trigger con stesso pattern di 1.2
    - Vincolo critico: nessuna modifica a `organizations.plan` o `user_plan.plan`
    - _Requirements: 6.1, 1.1_

  - [x] 1.5 Creare migrazione Supabase per aggiornamento additivo tabella `clients`
    - File: `supabase/migrations/20250800000004_pivot_contacts.sql`
    - Solo `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS` per: `phone TEXT`, `tax_id TEXT`, `default_currency TEXT DEFAULT 'EUR'`
    - Nessuna modifica a colonne esistenti, nessuna rinomina, nessuna DROP
    - _Requirements: 7.3, 16.5_


- [x] 2. IAP Module e Paywall Component
  - [x] 2.1 Creare `lib/iap-engine.ts`
    - Implementare tipi: `IAPProductId`, `EntitlementState`, `IAPEngineState`
    - Costanti: `IAP_CACHE_KEY = 'vela_iap_entitlements_v1'`, `CACHE_TTL_MS = 24h`
    - Implementare `fetchEntitlements(options?)`, `checkEntitlement(productId)`, `purchaseProduct(productId)`, `restorePurchases()`, `syncEntitlementsToCache(state)`, `readEntitlementsFromCache()`
    - Graceful degradation: se `Purchases.getCustomerInfo()` lancia eccezione → legge cache AsyncStorage; se cache assente → tutti entitlement inattivi + `networkError: true`
    - `purchaseProduct` aggiorna cache locale immediatamente dopo acquisto completato (Req 9.3)
    - Import permessi: SOLO `react-native-purchases` e `@react-native-async-storage/async-storage`
    - **ZERO import** da `rate-limit-engine.ts`, `PlanContext.tsx` o qualsiasi modulo che li re-esporta
    - _Requirements: 9.1, 9.3, 9.5, 9.6, 1.4_

  - [x] 2.2 Creare `components/IAPPaywall.tsx`
    - Props interface: `IAPPaywallProps` con `productId`, `featureName`, `featureDescription`, `onPurchaseSuccess`, `onDismiss`
    - Gestire internamente: caricamento prezzo da RevenueCat, flusso acquisto, flusso ripristino, gestione errori
    - Banner non bloccante se verifica entitlement fallisce per errore rete (Req 9.6)
    - Toast `"Nessun acquisto da ripristinare"` (chiave i18n `modal.pro_upgrade.restore.not_found` esistente) se ripristino non trova acquisti
    - **ZERO import** da `rate-limit-engine.ts` o `PlanContext.tsx`
    - _Requirements: 9.3, 9.5, 9.6, 10.2, 11.2, 5.5_


- [ ] 3. Estensione additiva PDF_Engine
  - [x] 3.1 Aggiungere tipi e interfacce a `lib/pdf-utils.ts` (solo append)
    - Aggiungere in coda al file: `DocumentType`, `QuoteData`, `ExpenseItem`, `ExpenseReportData`, `DocumentData`, `PDFGenerationOptionsExtended`
    - `PDFGenerationOptionsExtended extends PDFGenerationOptions` con campi opzionali `documentType?` e `templateId?`
    - `QuoteData` include `validUntil: Date` e `clientSnapshot: ClientSnapshot`
    - Le funzioni `generateInvoicePDF` e `shareInvoicePDF` esistenti NON vengono toccate in nessun modo
    - _Requirements: 14.1, 14.7, 17.1_

  - [x] 3.2 Implementare `generateDocumentPDF` in `lib/pdf-utils.ts`
    - Nuovo entry-point unificato — non chiama `generateInvoicePDF` internamente (retrocompatibilità isolata)
    - `documentType: 'invoice'` → HTML equivalente a `generateInvoicePDF` (stessi campi chiave: `invoiceNumber`, `total`, nome cliente)
    - `documentType: 'quote'` → intestazione `"PREVENTIVO"`, campo `"Valido fino al: <validUntil>"` al posto di scadenza, **nessuna** stringa `"FATTURA"` come header
    - `documentType: 'expense_report'` → tabella con colonne Data/Categoria/Importo/Descrizione, subtotali per categoria, `grandTotal` = somma di tutti gli `item.amount`
    - Se `documentType` non riconosciuto → lancia `Error('Unsupported documentType: <valore>')`
    - Se `documentType === 'invoice'` produce output strutturalmente diverso da `generateInvoicePDF` → lancia errore esplicito
    - Logo incluso nell'header se `options.logoUrl` fornito E entitlement `vela.logo.custom` attivo (controllato dal chiamante)
    - Ritorna `null` in caso di errore, logga `console.error` (stesso pattern esistente)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 4.3, 5.3, 3.2_


- [x] 4. Sezione Preventivi
  - [x] 4.1 Creare schermata lista preventivi `app/(app)/(tabs)/quotes.tsx`
    - Lista preventivi dell'organizzazione corrente da Supabase (`quotes` table)
    - Filtri per stato (`draft`, `sent`, `accepted`, `rejected`, `invoiced`)
    - Empty state specifico per la sezione Preventivi (testo non generico da Fatture)
    - Bottone CTA "Nuovo preventivo" → naviga a `app/(app)/quotes/new.tsx`
    - _Requirements: 4.1, 8.3_

  - [x] 4.2 Creare schermata creazione preventivo `app/(app)/quotes/new.tsx`
    - Form con campi: selezione cliente dalla Rubrica (picker inline che legge `clients` table), voci con descrizione/quantità/prezzo, data emissione, data validità (`validUntil`)
    - Pre-compilazione campi cliente tramite `ClientSnapshot` al momento del salvataggio (snapshot pattern)
    - Salvataggio su tabella `quotes`; nessun rate-limit
    - _Requirements: 4.2, 4.6, 4.7, 7.1, 7.2_

  - [x] 4.3 Creare schermata dettaglio preventivo `app/(app)/quotes/[id].tsx`
    - Visualizzazione dati preventivo leggendo `client_snapshot` (non FK `client_id`)
    - Azione "Genera PDF" → chiama `generateDocumentPDF` con `documentType: 'quote'`; se entitlement `vela.logo.custom` attivo passa `logoUrl`
    - Azione "Converti in Fattura": disponibile solo se `status === 'accepted'`; naviga a `app/(app)/invoices/new.tsx` pre-compilando i campi con i dati del preventivo
    - Aggiornamento stato (`draft` → `sent` → `accepted`/`rejected`)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 11.4_


- [x] 5. Rubrica Clienti
  - [x] 5.1 Creare tab `app/(app)/(tabs)/contacts.tsx` come wrapper di `clients`
    - Il file legge dalla tabella `clients` esistente (nessuna rinomina, nessuna view)
    - Lista clienti con campi: nome, email, P.IVA (`tax_id`), indirizzo, telefono, valuta predefinita (`default_currency`)
    - Operazioni CRUD: crea, modifica, elimina cliente
    - Eliminazione cliente: `ON DELETE SET NULL` su `client_id` — i documenti esistenti leggono `client_snapshot` e restano intatti
    - Empty state specifico Rubrica
    - Nessun rate-limit
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 2.4, 2.5_

  - [x] 5.2 Implementare picker inline cliente riutilizzabile
    - Componente `ClientPickerModal` (o inline dentro form) che legge dalla tabella `clients`
    - Alla selezione, il chiamante riceve il `ClientSnapshot` costruito dai dati del cliente selezionato
    - Riutilizzabile da form Preventivi, form Note spese e form Fatture esistente (se integrazione richiesta)
    - Pattern snapshot: `{ id: client.id, name: client.name, email, phone, address, taxId: client.tax_id, currency: client.default_currency ?? 'EUR' }`
    - _Requirements: 7.1, 7.2, 7.5_


- [x] 6. Excel Engine con IAP gate
  - [x] 6.1 Aggiungere dipendenza `xlsx` a `package.json`
    - Aggiungere `"xlsx": "0.18.5"` nelle `dependencies` (versione pinned)
    - Verificare che Metro bundler risolva il modulo correttamente (JS puro, nessun modulo nativo)
    - _Requirements: 5.4_

  - [x] 6.2 Creare `lib/excel-engine.ts`
    - Import: `import * as XLSX from 'xlsx'`, `expo-file-system`, `expo-sharing`
    - Implementare `generateExpenseXLSX(reports: ExpenseReportData[], options?: XLSXGenerationOptions): Promise<string>`
    - Struttura foglio: riga 1 intestazione `Data | Categoria | Importo | Valuta | Descrizione`, righe 2..N+1 dati, subtotali per categoria, riga totale complessivo (bold via stile cella)
    - Ritorna path assoluto del file `.xlsx` generato
    - Il modulo NON controlla l'entitlement IAP internamente — responsabilità del chiamante
    - Implementare `shareExpenseXLSX(filepath, filename)`: tenta `Sharing.shareAsync`; se fallisce → copia in `FileSystem.documentDirectory` + toast con path (fallback Req 5.6)
    - _Requirements: 5.4, 5.6_


- [x] 7. Sezione Note Spese
  - [x] 7.1 Creare schermata lista note spese `app/(app)/(tabs)/expenses.tsx`
    - Lista note spese dell'organizzazione corrente da Supabase (`expenses` table)
    - Empty state specifico Note spese (non generico da Fatture)
    - Bottone CTA "Nuova nota spese" → naviga a `app/(app)/expenses/new.tsx`
    - _Requirements: 5.1, 8.3_

  - [x] 7.2 Creare schermata creazione nota spese `app/(app)/expenses/new.tsx`
    - Form con campi: titolo, periodo (from/to), lista voci spesa (data, categoria, importo, valuta, descrizione opzionale)
    - Calcolo automatico `totalByCategory` e `grandTotal`
    - Salvataggio su tabella `expenses`; nessun rate-limit
    - _Requirements: 5.2, 5.7_

  - [x] 7.3 Creare schermata dettaglio nota spese `app/(app)/expenses/[id].tsx`
    - Visualizzazione voci, subtotali per categoria, totale complessivo
    - Azione "Genera PDF" → chiama `generateDocumentPDF` con `documentType: 'expense_report'`
    - Azione "Esporta Excel": controlla entitlement `vela.export.excel` tramite `checkEntitlement`
      - Se non attivo → mostra `IAPPaywall` con `productId: 'vela.export.excel'`
      - Se attivo → chiama `generateExpenseXLSX` poi `shareExpenseXLSX`
    - _Requirements: 5.3, 5.4, 5.5, 5.6_


- [x] 8. Estensione additiva Notification Service
  - [x] 8.1 Aggiungere nuovi tipi e funzioni a `lib/notifications-service.ts` (solo append)
    - Estendere `NotificationType` aggiungendo `'deadline_reminder'` all'unione esistente
    - Aggiungere interface `Reminder` (rispecchia tipo in `shared/types.ts`)
    - Implementare `scheduleReminderNotification(reminder: Reminder): Promise<string | null>`
      - Trigger = `reminder.dueDate`; `content.title = reminder.title`
      - Ritorna `notificationId` schedulato, o `null` se permesso non concesso
    - Implementare `cancelReminderNotification(reminderId: string): Promise<void>`
    - Implementare `requestNotificationPermission(): Promise<boolean>`
    - Implementare `hasNotificationPermission(): Promise<boolean>`
    - Le funzioni esistenti NON vengono modificate in nessun modo
    - _Requirements: 6.3, 6.5, 6.6_


- [x] 9. Sezione Promemoria Scadenze
  - [x] 9.1 Creare schermata lista promemoria `app/(app)/(tabs)/reminders.tsx`
    - Al primo accesso: chiama `hasNotificationPermission()` → se `false`, chiama `requestNotificationPermission()`
    - Se permesso negato → mostra Alert in-app con testo da chiave i18n `reminders.notification.permission_denied_msg`
    - Lista promemoria dell'organizzazione corrente da Supabase (`reminders` table)
    - Empty state specifico Promemoria
    - Bottone CTA "Nuovo promemoria" → naviga a `app/(app)/reminders/new.tsx`
    - _Requirements: 6.1, 6.5, 6.6, 8.3_

  - [x] 9.2 Creare schermata creazione promemoria `app/(app)/reminders/new.tsx`
    - Form con campi: titolo, data scadenza (`dueDate`), note opzionali, flag ricorrenza (`once` / `monthly` / `yearly`)
    - Al salvataggio: inserisce record su tabella `reminders`; poi chiama `scheduleReminderNotification(reminder)` se permesso concesso
    - `notificationId` restituito da scheduling viene salvato nel record Supabase
    - Se scheduling fallisce post-permesso → `notificationId = null`, avviso non bloccante nella lista
    - Nessun rate-limit
    - _Requirements: 6.2, 6.3, 6.7_

  - [x] 9.3 Creare schermata dettaglio/modifica promemoria `app/(app)/reminders/[id].tsx`
    - Modifica titolo, data, note, ricorrenza
    - Al salvataggio: cancella notifica esistente (`cancelReminderNotification`) → ri-schedula con nuovo `scheduleReminderNotification`
    - Azione "Segna come completato" → imposta `completed = true` e cancella notifica schedulata
    - Gestione rescheduling ricorrenza `monthly`/`yearly`: la schermata crea una nuova notifica per la data successiva dopo completamento
    - _Requirements: 6.2, 6.3_


- [x] 10. Espansione Tab Bar — Navigazione Multi-Sezione
  - [x] 10.1 Modificare `app/(app)/(tabs)/_layout.tsx` per Tab Bar a 7 voci
    - Aggiungere `<Tabs.Screen name="expenses">` con icona `receipt-outline` / `receipt`, i18n key `tabs.expenses.title`
    - Aggiungere `<Tabs.Screen name="reminders">` con icona `alarm-outline` / `alarm`, i18n key `tabs.reminders.title`
    - Aggiungere `<Tabs.Screen name="contacts">` con icona `people-outline` / `people`, i18n key `tabs.contacts.title`
    - Nascondere tab `clients` con `href: null` in `tabBarButton` (route rimane attiva per retrocompatibilità)
    - Ordine tab: Dashboard, Fatture, Preventivi, Note spese, Promemoria, Rubrica, Impostazioni
    - Applicare stili esistenti (`tabBarStyle`, `tabBarActiveTintColor`, `tabBarInactiveTintColor`) a tutti i nuovi tab
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 16.1_


- [x] 11. Pivot Naming — Aggiornamento chiavi i18n
  - [x] 11.1 Aggiornare chiavi naming-prodotto in tutti i file locale (`lib/locales/*.ts`)
    - File da aggiornare: `it.ts`, `en.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `zh.ts`
    - Chiavi da aggiornare (naming prodotto → non sezione Fatture):
      - `modal.pro_upgrade.subtitle`: rimuovere "Fatture illimitate" come unico beneficio → valore multi-sezione
      - `modal.pro_upgrade.feature.unlimited`: "Fatture illimitate" → "Documenti illimitati"
      - `login.subtitle`: se contiene "fattura/e" come sinonimo prodotto → aggiornare a "VELA"
      - Testi onboarding dove "fattura/e" descrive l'app intera → "VELA", "documento", o nome sezione
    - Chiavi da mantenere invariate: `newInvoice`, `tabs.invoices.*`, `invoice_*` form, `milestone.first_invoice.*`
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 15.1, 15.3_

  - [x] 11.2 Aggiungere nuove chiavi i18n per le tre nuove sezioni in tutti i file locale
    - Aggiungere in tutti `lib/locales/*.ts` (tradotte nella lingua del file):
      - `tabs.expenses.title`, `tabs.reminders.title`, `tabs.contacts.title`
      - `tabs.expenses.empty.title`, `tabs.expenses.empty.hint`, `tabs.expenses.empty.cta`
      - `tabs.reminders.empty.title`, `tabs.reminders.empty.hint`, `tabs.reminders.empty.cta`
      - `tabs.contacts.empty.title`, `tabs.contacts.empty.cta`
      - `iap.excel.name`, `iap.excel.description`, `iap.template.name`, `iap.logo.name`, `iap.backup.name`
      - `reminders.notification.permission_denied_title`, `reminders.notification.permission_denied_msg`
    - _Requirements: 8.3, 8.5, 16.4_


- [x] 12. Checkpoint — Verifica compilazione TypeScript e dipendenze IAP
  - Eseguire `tsc --noEmit` su tutti i nuovi moduli: zero errori di tipo
  - Verificare con grep che `iap-engine.ts` non contenga `import` da `rate-limit-engine.ts` o `PlanContext.tsx`
  - Verificare che `generateInvoicePDF` e `shareInvoicePDF` siano invariati (firma, corpo, comportamento)
  - Assicurarsi che tutte le migrazioni siano idempotenti (`IF NOT EXISTS`, `DO $$ BEGIN...EXCEPTION...END`)
  - Chiedere all'utente conferma prima di procedere con i test se emergono dubbi.


- [ ] 13. Property-Based Tests — `fast-check`
  - [x] 13.1 Aggiungere `fast-check` alle `devDependencies` di `package.json`
    - Aggiungere `"fast-check": "3.22.0"` (versione pinned) nelle `devDependencies`
    - Verificare compatibilità con Jest/jest-expo esistente
    - _Requirements: Design — Testing Strategy_

  - [ ]* 13.2 Scrivere property test P1 — Retrocompatibilità PDF_Engine invoice round-trip
    - File: `__tests__/pdf-engine.property.test.ts`
    - **Property 1: Retrocompatibilità PDF_Engine — invoice round-trip**
    - Generare `Invoice` arbitrari con `fc.record(...)` (invoiceNumber non vuoto, total > 0, lineItems non vuoto)
    - Verificare che `generateDocumentPDF(invoice, { documentType: 'invoice' })` produca HTML non nullo contenente `invoiceNumber`, `total` formattato e nome cliente (se presente)
    - Mock: `expo-file-system` (write)
    - Minimum 100 runs
    - **Validates: Requirements 3.2, 3.3, 14.4**

  - [ ]* 13.3 Scrivere property test P2 — Quote PDF header e campo obbligatori
    - File: `__tests__/pdf-engine.property.test.ts`
    - **Property 2: Quote PDF contiene header e campo obbligatori**
    - Generare `QuoteData` arbitrari (quoteNumber non vuoto, validUntil valida, lineItems non vuoto)
    - Verificare che HTML contenga `"PREVENTIVO"`, `"Valido fino al"` e NON contenga `"FATTURA"` come header
    - Mock: `expo-file-system`
    - Minimum 100 runs
    - **Validates: Requirements 4.3, 14.5**

  - [ ]* 13.4 Scrivere property test P3 — Expense Report PDF coerenza righe e totale
    - File: `__tests__/pdf-engine.property.test.ts`
    - **Property 3: Expense Report PDF — coerenza righe e totale**
    - Generare `ExpenseReportData` arbitrari con N voci (N ≥ 1)
    - Verificare che HTML contenga N righe dati e che `grandTotal` === somma di tutti gli `item.amount`
    - Mock: `expo-file-system`
    - Minimum 100 runs
    - **Validates: Requirements 5.3, 14.6**

  - [ ]* 13.5 Scrivere property test P4 — Excel Engine conteggio righe corretto
    - File: `__tests__/excel-engine.property.test.ts`
    - **Property 4: Excel Engine — conteggio righe corretto**
    - Generare `ExpenseReportData` arbitrari con N voci (N ≥ 1)
    - Verificare che il file `.xlsx` generato contenga ≥ N + 1 righe nel foglio principale (N dati + ≥ 1 totale, escludendo intestazione)
    - Mock: `expo-file-system`, `expo-sharing`
    - Minimum 100 runs
    - **Validates: Requirements 5.4**

  - [ ]* 13.6 Scrivere property test P5 — Snapshot cliente immutabile dopo eliminazione
    - File: `__tests__/client-snapshot.property.test.ts`
    - **Property 5: Snapshot cliente immutabile dopo eliminazione**
    - Generare coppie `(ClientSnapshot, Document)` arbitrarie
    - Simulare operazione `DELETE` su cliente → verificare che `document.clientSnapshot` sia byte-per-byte identico al valore originale
    - Mock: Supabase client
    - Minimum 100 runs
    - **Validates: Requirements 7.6**

  - [ ]* 13.7 Scrivere property test P6 — Reminder notification trigger e titolo corretti
    - File: `__tests__/notifications.property.test.ts`
    - **Property 6: Reminder notification — trigger e titolo corretti**
    - Generare `Reminder` arbitrari con `dueDate` nel futuro e `title` non vuoto
    - Verificare che `scheduleReminderNotification(reminder)` restituisca `notificationId` non nullo
    - Verificare che notifica schedulata abbia `trigger.date` ≈ `reminder.dueDate` (±1 sec) e `content.title === reminder.title`
    - Mock: `expo-notifications`
    - Minimum 100 runs
    - **Validates: Requirements 6.3**

  - [ ]* 13.8 Scrivere property test P7 — IAP cache fallback con cache recente
    - File: `__tests__/iap-engine.property.test.ts`
    - **Property 7: IAP cache fallback — nessuna degradazione pessimistica con cache recente**
    - Generare `EntitlementState` arbitrari con `cachedAt` entro le ultime 24h e `isActive: true`
    - Simulare `Purchases.getCustomerInfo()` che lancia eccezione (errore rete)
    - Verificare che `checkEntitlement(productId)` restituisca `true` (non degrada a `false` con cache recente valida)
    - Mock: `react-native-purchases`, `AsyncStorage`
    - Minimum 100 runs
    - **Validates: Requirements 9.6**

  - [ ]* 13.9 Scrivere property test P8 — Nessun rate-limit sulla creazione di documenti
    - File: `__tests__/no-rate-limit.property.test.ts`
    - **Property 8: Nessun rate-limit sulla creazione di documenti**
    - Generare sequenze di N operazioni di creazione (N ≥ 1, tipo arbitrario tra quote/expense/reminder/contact)
    - Verificare che nessuna operazione restituisca errore con reason `'limit_reached'`, `'boost_required'`, `'premium_required'` o codici che implicano blocchi quantitativi
    - Mock: Supabase client
    - Minimum 100 runs
    - **Validates: Requirements 1.5, 4.7, 5.7, 6.7, 7.4, 9.7**


- [ ] 14. Unit Test
  - [ ]* 14.1 Scrivere unit test per Tab Bar aggiornata
    - File: `__tests__/tab-layout.test.tsx`
    - Snapshot del `_layout.tsx` aggiornato: verificare 7 tab nell'ordine corretto (Dashboard, Fatture, Preventivi, Note spese, Promemoria, Rubrica, Impostazioni)
    - Verificare che tab `clients` abbia `href: null`
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ]* 14.2 Scrivere unit test per componente `IAPPaywall`
    - File: `__tests__/iap-paywall.test.tsx`
    - Test rendering con entitlement non attivo: paywall visibile con pulsante acquisto
    - Test rendering con entitlement attivo: paywall non visibile
    - Test flusso acquisto: `onPurchaseSuccess` chiamato dopo acquisto completato
    - Test flusso ripristino: toast `modal.pro_upgrade.restore.not_found` se nessun acquisto trovato
    - _Requirements: 9.3, 9.5_

  - [ ]* 14.3 Scrivere unit test per conversione preventivo → fattura
    - File: `__tests__/quote-to-invoice.test.ts`
    - Verifica che navigazione a `invoices/new` pre-compili correttamente: `clientSnapshot`, `lineItems`, `total`, `taxRate`
    - Verifica che la conversione sia disponibile solo per `status === 'accepted'`
    - _Requirements: 4.4_

  - [ ]* 14.4 Scrivere unit test per flusso permesso notifiche
    - File: `__tests__/notification-permission.test.ts`
    - Test primo accesso sezione Promemoria: `hasNotificationPermission()` → false → `requestNotificationPermission()` chiamato
    - Test permesso negato: Alert in-app con messaggio da `reminders.notification.permission_denied_msg` mostrato
    - Test promemoria salvato anche se permesso negato (salvataggio non bloccato)
    - _Requirements: 6.5, 6.6_

  - [ ]* 14.5 Scrivere unit test per paywall Excel e flusso export
    - File: `__tests__/excel-paywall.test.ts`
    - Test entitlement `vela.export.excel` inattivo: `IAPPaywall` mostrato, `generateExpenseXLSX` non chiamato
    - Test entitlement attivo: `generateExpenseXLSX` chiamato, poi `shareExpenseXLSX` avviato
    - _Requirements: 5.5, 5.6_

  - [ ]* 14.6 Scrivere unit test per `iap-engine.ts` — acquisto e cache
    - File: `__tests__/iap-engine.test.ts`
    - Test acquisto IAP completato: `EntitlementState.isActive` aggiornato a `true` in cache locale immediatamente (Req 9.3)
    - Test `checkEntitlement` con cache assente e network error: ritorna `false` (pessimistic fallback)
    - Test `restorePurchases`: aggiorna tutti gli entitlement trovati
    - _Requirements: 9.3, 9.6_


- [ ] 15. Test di Integrazione
  - [ ]* 15.1 Test integrazione RLS Supabase — isolamento organizzazioni
    - File: `__tests__/supabase-rls.integration.test.ts`
    - Verifica che utente A non possa leggere `quotes`, `expenses`, `reminders` dell'organizzazione B
    - Pattern: crea due org con RLS attiva, verifica accesso incrociato negato
    - _Requirements: 4.6, 5.1, 6.1_

  - [ ]* 15.2 Test integrazione invarianza schema — plan columns
    - File: `__tests__/schema-invariance.integration.test.ts`
    - Dopo l'esecuzione di tutte e 4 le migrazioni pivot, verifica che `organizations.plan` e `user_plan.plan` abbiano esattamente gli stessi tipi e vincoli di prima
    - _Requirements: 1.1_

  - [ ]* 15.3 Smoke test TypeScript — zero errori su nuovi moduli
    - File: `__tests__/tsc-smoke.integration.test.ts` (o script separato)
    - Esegui `tsc --noEmit` verificando zero errori su: `lib/iap-engine.ts`, `lib/excel-engine.ts`, `lib/pdf-utils.ts` (parte additiva), `lib/notifications-service.ts` (parte additiva), `components/IAPPaywall.tsx`, nuovi file di route
    - _Requirements: 14.1, 14.7, 17.2_

  - [ ]* 15.4 Smoke test dipendenze IAP — zero import proibiti
    - File: `__tests__/iap-deps.integration.test.ts` (o script grep nella CI)
    - Verifica con grep che `lib/iap-engine.ts` non contenga stringhe `rate-limit-engine` o `PlanContext`
    - Verifica che `components/IAPPaywall.tsx` non importi da `rate-limit-engine.ts` o `PlanContext.tsx`
    - _Requirements: 1.4, 9.1_


- [x] 16. Checkpoint finale — Verifica completa
  - Tutti i test (unit, property, integration) devono passare senza errori
  - `tsc --noEmit` zero errori
  - Grep di sicurezza: `iap-engine.ts` e `IAPPaywall.tsx` senza import da `rate-limit-engine` o `PlanContext`
  - Grep di sicurezza: `generateInvoicePDF` e `shareInvoicePDF` con firma e corpo invariati
  - Verificare che tutte le 5 sezioni siano accessibili dalla Tab Bar nell'ordine corretto
  - Chiedere all'utente conferma prima di procedere al deployment se emergono dubbi.

---

- [x] 17. Rebrand PDF_Engine — sostituire "VELA" con "Milo Office" nei default hardcoded
  - Aprire `lib/pdf-utils.ts` e sostituire esattamente le 7 occorrenze hard-coded:
    - Riga 26: `companyName = 'VELA'` → `companyName = 'Milo Office'` (default in `generateInvoicePDF`)
    - Riga 557: `<p>Generated by VELA</p>` → `<p>Generated by Milo Office</p>` (footer HTML invoice EN)
    - Riga 611: `options.companyName ?? 'VELA'` → `options.companyName ?? 'Milo Office'` (default in `generateInvoiceDocumentHTML`)
    - Riga 649: `<p>Generato da VELA</p>` → `<p>Generato da Milo Office</p>` (footer HTML invoice IT)
    - Riga 701: `options.companyName ?? 'VELA'` → `options.companyName ?? 'Milo Office'` (default in `generateQuoteDocumentHTML`)
    - Riga 744: `<p>Generato da VELA</p>` → `<p>Generato da Milo Office</p>` (footer HTML preventivo IT)
    - Riga 786: `options.companyName ?? 'VELA'` → `options.companyName ?? 'Milo Office'` (default in `generateExpenseReportDocumentHTML`)
  - Vincoli: NON modificare la firma di `generateInvoicePDF` o `shareInvoicePDF`; i parametri opzionali `companyName` restano opzionali; chi passa `companyName` esplicito non è toccato; zero modifica al comportamento
  - _Requirements: 18.3, 18.6_


- [x] 18. Document_Format_Engine — generazione DOC/RTF via libreria JS pura
  - [x] 18.1 Aggiungere dipendenza `docx` a `package.json`
    - Aggiungere `"docx": "8.5.0"` nelle `dependencies` (versione pinned, JS puro, compatibile Metro)
    - RTF non richiede dipendenze esterne (generazione testuale strutturata)
    - _Requirements: 19.1, 19.4_

  - [x] 18.2 Creare `lib/document-format-engine.ts`
    - Definire tipo `DocumentData` (struttura dati unificata con campi: `title`, `type: 'invoice' | 'quote' | 'expense_report'`, `lineItems`, `totals`, `clientSnapshot`, `metadata`)
    - Implementare `generateDocumentDOC(data: DocumentData, options): Promise<string>` — produce file `.docx` reale via pacchetto `docx`; i metadati del file includono `creator: 'Milo Office'` e `company: 'Milo Office'`; il file DOCX deve essere apribile in Word/LibreOffice (non un PDF rinominato)
    - Implementare `generateDocumentRTF(data: DocumentData, options): Promise<string>` — produce file `.rtf` reale (RTF è plain text strutturato); include comment header `{\*\generator Milo Office}` nei metadati RTF
    - Implementare `shareDocument(filepath: string, filename: string): Promise<void>` — via `expo-sharing`
    - Se la generazione nel formato selezionato fallisce → notificare l'utente con messaggio comprensibile, NON produrre file parziale o corrotto (Req 19.9)
    - Il modulo NON controlla entitlement IAP internamente — responsabilità del chiamante
    - _Requirements: 19.1, 19.4, 19.6, 19.8, 19.9, 18.4_

  - [ ]* 18.3 Task ODT — rinviato (opzionale, dipendenza da confermare)
    - ⚠️ Nessuna libreria ODT JS pura mantenuta attivamente è confermata compatibile con Metro/RN senza native modules
    - Questo sub-task è marcato opzionale in attesa di ricerca e verifica della dipendenza
    - MVP copre PDF + DOCX + RTF; ODT può essere aggiunto in un secondo momento
    - _Requirements: 19.1, 19.5_


- [x] 19. UI selezione formato — `FormatPickerModal` component
  - [x] 19.1 Creare `components/FormatPickerModal.tsx`
    - Props: `visible: boolean`, `selectedFormat: 'pdf' | 'doc' | 'rtf' | null`, `onSelect(format: 'pdf' | 'doc' | 'rtf'): void`, `onDismiss(): void`
    - Mostra 3 opzioni (PDF / DOCX / RTF) con icona, nome e descrizione breve
    - Persiste l'ultima scelta via `AsyncStorage` alla chiave `milo_last_doc_format`
    - Al primo uso (nessuna preferenza salvata) → nessun formato pre-selezionato, selezione esplicita richiesta
    - Chiavi i18n: `format_picker.title`, `format_picker.pdf`, `format_picker.doc`, `format_picker.rtf`
    - _Requirements: 19.2, 19.3, 18.5_

  - [x] 19.2 Integrare `FormatPickerModal` in `app/(app)/quotes/[id].tsx`

    - Bottone "Genera documento" apre `FormatPickerModal` prima di chiamare il generatore
    - Se formato = `pdf` → chiama `generateDocumentPDF` (Task 3.2)
    - Se formato = `doc` o `rtf` → chiama `generateDocumentDOC` / `generateDocumentRTF` (Task 18.2)
    - _Requirements: 19.2, 19.7_

  - [x] 19.3 Integrare `FormatPickerModal` in `app/(app)/expenses/[id].tsx`
    - Stessa integrazione di 19.2 per la schermata dettaglio nota spese
    - _Requirements: 19.2, 19.7_

  - [x] 19.4 Integrare `FormatPickerModal` in `app/(app)/[invoice].tsx`
    - Stessa integrazione di 19.2 per la schermata dettaglio fattura
    - _Requirements: 19.2, 19.7_


- [x] 20. Quota_Engine — contatore backend su Supabase
  - [x] 20.1 Creare migrazione Supabase `supabase/migrations/20250800000005_quota_engine.sql`
    - `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS documents_generated_total INTEGER NOT NULL DEFAULT 0`
    - `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS quota_limit INTEGER NOT NULL DEFAULT 5` — valore da confermare da Posky prima del rilascio
    - RLS: stessa policy org-owner esistente (nessuna policy nuova)
    - Funzione RPC atomica: `CREATE OR REPLACE FUNCTION public.increment_document_quota(org_id UUID) RETURNS INTEGER AS $$ UPDATE public.organizations SET documents_generated_total = documents_generated_total + 1 WHERE id = org_id AND documents_generated_total < quota_limit RETURNING documents_generated_total $$ LANGUAGE sql SECURITY DEFINER`
    - Vincolo critico: NON modificare `organizations.plan`, `user_plan.plan`, `Rate_Limit_Engine`, `PlanContext`
    - _Requirements: 20.1, 20.6, 20.7, 1.1_

  - [x] 20.2 Creare `lib/quota-engine.ts`
    - Definire tipi: `QuotaCheckResult { allowed: boolean; remaining: number; total: number; limit: number }`
    - Implementare `checkQuota(orgId: string): Promise<QuotaCheckResult>` — legge `documents_generated_total` e `quota_limit` da Supabase; se premium (RevenueCat via `iap-engine.ts`) → sempre `allowed: true`; cache locale AsyncStorage con TTL 5 minuti
    - Implementare `incrementQuota(orgId: string): Promise<void>` — chiama RPC `increment_document_quota`; lancia eccezione se quota esaurita; invalida cache locale immediatamente dopo ogni generazione
    - Implementare `getRemainingQuota(orgId: string): Promise<number>` — restituisce `quota_limit - documents_generated_total`
    - **ZERO import** da `rate-limit-engine.ts` o `PlanContext.tsx`
    - _Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.8, 20.9, 20.10, 1.4_

  - [x] 20.3 Integrare gate quota nelle schermate di generazione documento
    - Prima di chiamare qualsiasi generatore (PDF/DOCX/RTF) in `quotes/[id].tsx`, `expenses/[id].tsx`, `[invoice].tsx`:
      - Chiamare `checkQuota(orgId)` → se `allowed: false` → mostrare paywall quota (componente `QuotaPaywall.tsx` o riusare `IAPPaywall`)
      - Se `allowed: true` → generare il documento, poi chiamare `incrementQuota(orgId)`
    - Esporre all'utente il numero di documenti rimanenti (chiave i18n `quota.remaining`)
    - _Requirements: 20.3, 20.7, 20.8, 1.5_


- [x] 21. Translation_Service — Gemini Flash per contenuti documento
  - [x] 21.1 Aggiungere dipendenza Gemini Flash a `package.json`
    - Aggiungere `"@google/generative-ai": "0.21.0"` nelle `dependencies` (versione pinned, compatibile React Native/Metro)
    - _Requirements: 21.1, 21.2_

  - [x] 21.2 Creare `lib/translation-service.ts`
    - Definire costante `SUPPORTED_TRANSLATION_LANGUAGES` — array di 10 lingue: `it`, `en`, `es`, `fr`, `de`, `pt`, `zh`, `ar`, `ja`, `ru` (con campi `code`, `displayName`, `flag`)
    - Definire tipi: `TranslatableFields { title?: string; descriptions: string[]; notes?: string }`, `TranslationResult { fields: TranslatableFields; translated: boolean; error?: string }`
    - Implementare `translateDocumentContent(fields: TranslatableFields, targetLang: string): Promise<TranslationResult>` — invia solo i campi testuali dell'utente (titolo, descrizioni voci, note) a Gemini Flash; NON invia valori numerici, date, email, P.IVA
    - Timeout API: 30 secondi; se scaduto → lancia `TranslationTimeoutError` e restituisce i campi originali con `{ translated: false, error: 'timeout' }`
    - Gestione errori: se Gemini non raggiungibile → restituisce campi originali + `{ translated: false, error: string }` senza bloccare l'app
    - Il servizio NON incrementa il Quota_Engine (la traduzione non conta come generazione documento)
    - **ZERO invio** di credenziali, identificatori sessione, Product_ID IAP all'API
    - _Requirements: 21.1, 21.2, 21.3, 21.6, 21.7, 21.10_

  - [x] 21.3 Creare `components/LanguagePickerModal.tsx`
    - Props: `visible: boolean`, `onSelect(lang: string): void`, `onDismiss(): void`
    - Lista le 10 lingue supportate (`SUPPORTED_TRANSLATION_LANGUAGES`) con flag e nome display
    - Chiavi i18n: `translator.title`, `translator.select_language`, `translator.auto_label`
    - _Requirements: 21.1, 21.5_

  - [x] 21.4 Integrare bottone "Traduci contenuto" nelle schermate dettaglio
    - Aggiungere bottone "Traduci contenuto" in `app/(app)/quotes/[id].tsx`, `app/(app)/expenses/[id].tsx`, `app/(app)/[invoice].tsx`
    - Flusso: tap "Traduci" → `LanguagePickerModal` → chiama `translateDocumentContent` → aggiorna stato locale schermata con testi tradotti → rigenera documento nel formato già selezionato da `FormatPickerModal` (Task 19)
    - Il documento rigenerato con testo tradotto porta il disclaimer `translator.auto_label` nel footer
    - Mostrare tooltip o didascalia `translator.privacy_note` per informare l'utente dell'invio dati all'API (GDPR)
    - _Requirements: 21.2, 21.4, 21.5, 21.8, 19.4_


- [x] 22. Chiavi i18n mancanti — reminders, expenses, traduttore, formato
  - Aggiungere in tutti e 7 i file `lib/locales/*.ts` (tradotte correttamente nella lingua del file — NON copiare il testo italiano):
  - `tabs.reminders.title`, `tabs.reminders.empty.title`, `tabs.reminders.empty.hint`, `tabs.reminders.empty.cta`
  - `tabs.expenses.title`, `tabs.expenses.empty.title`, `tabs.expenses.empty.hint`, `tabs.expenses.empty.cta`
  - Correggere `tabs.contacts.*` in `fr.ts`, `de.ts`, `zh.ts`, `es.ts` dove il testo è rimasto in italiano invece della traduzione nella lingua del file
  - `format_picker.title`, `format_picker.pdf`, `format_picker.doc`, `format_picker.rtf`
  - `translator.title`, `translator.select_language`, `translator.auto_label`, `translator.privacy_note`
  - `quota.remaining` (es. "Ti restano {n} documenti gratuiti" in IT — tradurre nella lingua del file), `quota.exhausted.title`, `quota.exhausted.cta`
  - _Requirements: 18.1, 18.7, 19.3, 21.5_


- [ ] 23. Property tests — nuovi requisiti 18–21
  - [ ]* 23.1 Scrivere property test P9 — Document_Format_Engine: output DOC non è PDF rinominato
    - File: `__tests__/document-format-engine.property.test.ts`
    - **Property 9: Document_Format_Engine — DOC output non è PDF rinominato**
    - Generare `DocumentData` arbitrari con campi testuali non vuoti
    - Verificare che il buffer del file `.docx` generato inizi con magic bytes DOCX (`50 4B 03 04` — header PK ZIP)
    - Verificare che il buffer del file `.rtf` generato inizi con magic bytes RTF (`7B 5C 72 74 66` — `{\rtf`)
    - Mock: `expo-file-system`, `expo-sharing`
    - Minimum 100 runs
    - **Validates: Requirements 19.4, 19.6**

  - [ ]* 23.2 Scrivere property test P10 — Quota_Engine: contatore non supera soglia
    - File: `__tests__/quota-engine.property.test.ts`
    - **Property 10: Quota_Engine — contatore non supera soglia**
    - Generare quota N arbitraria (1 ≤ N ≤ 20) e simulare N generazioni di documenti
    - Verificare che le prime N chiamate a `checkQuota` restituiscano `allowed: true`
    - Verificare che la (N+1)-esima chiamata restituisca `allowed: false`
    - Mock: Supabase client (RPC `increment_document_quota` con contatore in memoria)
    - Minimum 100 runs
    - **Validates: Requirements 20.3, 20.6**

  - [ ]* 23.3 Scrivere property test P11 — Translation_Service: non invia campi non testuali a Gemini
    - File: `__tests__/translation-service.property.test.ts`
    - **Property 11: Translation_Service — non invia campi non testuali a Gemini**
    - Generare `DocumentData` arbitrari con valori numerici, date ISO (`\d{4}-\d{2}-\d{2}`), email (`.*@.*`) e P.IVA (`IT\d{11}`)
    - Mock dell'API Gemini che registra il payload ricevuto
    - Verificare che il payload inviato non contenga nessun valore numerico, nessuna data ISO, nessuna stringa email, nessuna P.IVA
    - Minimum 100 runs
    - **Validates: Requirements 21.3, 21.10**

  - [ ]* 23.4 Scrivere property test P12 — Translation_Service: fallback graceful su timeout
    - File: `__tests__/translation-service.property.test.ts`
    - **Property 12: Translation_Service — fallback graceful su timeout**
    - Generare `TranslatableFields` arbitrari con testi non vuoti
    - Mock Gemini che lancia `TranslationTimeoutError` dopo 30 secondi (simulato)
    - Verificare che `translateDocumentContent` restituisca i campi originali invariati con `{ translated: false, error: 'timeout' }` senza bloccare l'app (nessuna eccezione non gestita)
    - Minimum 100 runs
    - **Validates: Requirements 21.6**


- [x] 25. Rewarded Ads — +1 documento oltre quota gratuita (Google Ads SSV)
  - [x] 25.1 Creare Supabase Edge Function `supabase/functions/reward-document-credit/index.ts`
    - Endpoint POST che riceve il token SSV firmato da Google Ads (`reward_token`, `user_id`)
    - Verifica la firma del token SSV lato server (Google pubblica la chiave pubblica per la verifica)
    - Se valida: chiama RPC Supabase `grant_reward_document(org_id)` che incrementa `documents_generated_total` di -1 (ovvero aumenta la quota disponibile di 1), con vincolo `daily_reward_count <= 3` per org per giorno
    - Risponde `200 OK` o `403 Forbidden` — il client NON incrementa il contatore direttamente
    - Il parametro `user_id` viene mappato a `org_id` tramite la tabella `organizations` (stessa logica delle altre RPC)
    - **ZERO incremento lato client** — l'unico path di incremento è la risposta 200 da questo endpoint
    - ⚠️ CLAIM CRITICO BUDGET: verificare PRIMA che il piano Supabase free tier attuale abbia margine per Edge Functions (numero invocazioni/mese)
    - _Requirements: 20.3, 20.7_

  - [x] 25.2 Aggiungere RPC Supabase `grant_reward_document` alla migrazione quota
    - Aggiungere in `supabase/migrations/20250800000005_quota_engine.sql` (o nuova migration `_006`):
    - Colonna `documents_reward_credits INTEGER NOT NULL DEFAULT 0` su `organizations` — crediti extra da rewarded ad, separati da `documents_generated_total`
    - Colonna `daily_reward_date DATE`, `daily_reward_count INTEGER NOT NULL DEFAULT 0` per rate limit giornaliero (max 3 reward/giorno per org)
    - Funzione `grant_reward_document(org_id UUID)`: controlla `daily_reward_count < 3`, incrementa `documents_reward_credits + 1` e `daily_reward_count + 1`, reimposta contatori se `daily_reward_date < today`
    - `checkQuota` in `quota-engine.ts` considera `documents_reward_credits` aggiuntivi: `allowed = (documents_generated_total < quota_limit + documents_reward_credits)`
    - _Requirements: 20.3, 20.4_

  - [x] 25.3 Integrare rewarded ad UI nel paywall quota
    - Nel componente `QuotaPaywall` (Task 20.3), aggiungere secondo CTA: "Guarda un video per +1 documento"
    - Handler: avvia rewarded ad Google Ads tramite `react-native-google-mobile-ads` (già presente in `package.json`)
    - `onUserEarnedReward`: chiama endpoint Supabase Edge Function `reward-document-credit` con token SSV — NON incrementa contatore localmente
    - Se la chiamata SSV restituisce 200 → invalida cache `quota-engine.ts` → ricarica quota → riabilita bottone generazione
    - Se la chiamata SSV restituisce errore → mostra messaggio non bloccante, NON accredita il documento
    - Chiavi i18n: `quota.reward_cta`, `quota.reward_pending`, `quota.reward_success`, `quota.reward_failed`
    - _Requirements: 20.3, 20.8_

  - [ ]* 25.4 Property test P13 — Rewarded ad: incremento avviene solo via SSV
    - File: `__tests__/reward-ad.property.test.ts`
    - **Property 13: Rewarded ad — contatore incrementato solo da risposta SSV 200, mai dal client**
    - Simulare `onUserEarnedReward` senza risposta SSV → verificare che `documents_reward_credits` sia invariato
    - Simulare risposta SSV 200 → verificare che `documents_reward_credits` sia incrementato di 1
    - Simulare risposta SSV 403 → verificare che `documents_reward_credits` sia invariato
    - Mock: Supabase Edge Function, `react-native-google-mobile-ads`
    - Minimum 100 runs
    - **Validates: Requirements 20.3, anti-pattern client-side increment**


- [x] 24. Checkpoint finale nuovi requisiti — Verifica compilazione e dipendenze
  - Eseguire `tsc --noEmit` su tutti i nuovi moduli: `lib/document-format-engine.ts`, `lib/quota-engine.ts`, `lib/translation-service.ts`, `components/FormatPickerModal.tsx`, `components/LanguagePickerModal.tsx` — zero errori di tipo
  - Verificare con grep che `quota-engine.ts` non contenga `import` da `rate-limit-engine.ts`, `PlanContext.tsx`; che `translation-service.ts` non invii identificatori di sessione o Product_ID IAP
  - Verificare con grep che `lib/pdf-utils.ts` non contenga più la stringa `'VELA'` come valore di default (le 7 occorrenze devono essere tutte `'Milo Office'`)
  - Verificare che le firme di `generateInvoicePDF` e `shareInvoicePDF` siano rimaste invariate
  - Verificare che tutti e 7 i file locale (`lib/locales/*.ts`) contengano le nuove chiavi i18n (`format_picker.*`, `translator.*`, `quota.*`, `tabs.reminders.*`, `tabs.expenses.*`)
  - Chiedere all'utente conferma prima di procedere se emergono dubbi.

---

## Notes

- Task con `*` sono opzionali e possono essere saltati per un MVP più rapido
- Ogni task referenzia i requisiti specifici per tracciabilità
- Il tab `clients` rimane attivo (non modificato) ma nascosto dalla Tab Bar — retrocompatibilità garantita
- I Product_ID IAP devono essere creati su Play Console e RevenueCat **prima** che il modulo `iap-engine.ts` venga deployato in produzione (azione manuale Posky — blocca il deploy del task 2.1, non blocca lo sviluppo locale con mock)
- Le migrazioni usano `IF NOT EXISTS` e gestione eccezioni `DO $$ BEGIN...END $$` — sono safe da rieseguire
- Property tests non fanno chiamate a Supabase né a RevenueCat — usano mock e funzioni pure
- Minimum 100 runs per ogni property test (configurare in `fc.assert(..., { numRuns: 100 })`)
- Ogni property test deve avere il tag: `// Feature: vela-pivot-prodotto, Property N: <testo breve>`
- Il valore `quota_limit` (default 5) è soggetto a conferma da Posky prima del rilascio — aggiornare la migrazione 20250800000005 prima del deploy in produzione
- Task 18.3 (ODT) è marcato opzionale: MVP = PDF + DOCX + RTF; ODT richiede ricerca e verifica di una libreria JS pura compatibile Metro prima di essere schedulato
- `translation-service.ts` invia contenuti testuali del documento all'API Gemini — comunicare questa informazione all'utente tramite `translator.privacy_note` (requisito GDPR)


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "3.1"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "3.2", "6.1"]
    },
    {
      "id": 3,
      "tasks": ["4.1", "5.1", "6.2", "8.1"]
    },
    {
      "id": 4,
      "tasks": ["4.2", "4.3", "5.2", "7.1", "9.1"]
    },
    {
      "id": 5,
      "tasks": ["7.2", "7.3", "9.2", "9.3", "10.1", "11.1"]
    },
    {
      "id": 6,
      "tasks": ["11.2", "13.1"]
    },
    {
      "id": 7,
      "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "14.1", "14.2", "14.3", "14.4", "14.5", "14.6"]
    },
    {
      "id": 8,
      "tasks": ["15.1", "15.2", "15.3", "15.4"]
    },
    {
      "id": 9,
      "tasks": ["17"]
    },
    {
      "id": 10,
      "tasks": ["18.1", "20.1"]
    },
    {
      "id": 11,
      "tasks": ["18.2", "19.1", "20.2", "21.1"]
    },
    {
      "id": 12,
      "tasks": ["18.3", "19.2", "19.3", "19.4", "20.3", "21.2", "21.3", "22"]
    },
    {
      "id": 13,
      "tasks": ["21.4", "23.1", "23.2", "23.3", "23.4"]
    },
    {
      "id": 14,
      "tasks": ["25.1", "25.2"]
    },
    {
      "id": 15,
      "tasks": ["25.3", "24"]
    },
    {
      "id": 16,
      "tasks": ["25.4"]
    }
  ]
}
```
