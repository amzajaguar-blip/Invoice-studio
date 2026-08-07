# Documento dei Requisiti — VELA Pivot Prodotto

## Introduction

VELA evolve da "generatore di fatture PDF" a **"quaderno del professionista"**: una suite multi-sezione per la gestione documentale del libero professionista italiano. Il prodotto mantiene intatta la sezione Fatture esistente e aggiunge quattro nuove sezioni (Preventivi, Note spese, Promemoria scadenze, Rubrica clienti). La monetizzazione migra da abbonamento freemium con limiti quantitativi a **IAP one-time** su feature specifiche, eliminando ogni forma di rate-limit su qualsiasi sezione. Il naming dell'app — ovunque "fattura/e" sia usato come sinonimo del prodotto intero — viene aggiornato a "VELA" o al nome della sezione corretta.

---

## Glossario

- **VELA_App**: Il prodotto mobile React Native/Expo ("quaderno del professionista"), precedentemente noto anche come Invoice Studio.
- **Sezione**: Una delle cinque aree funzionali dell'app (Fatture, Preventivi, Note spese, Promemoria scadenze, Rubrica clienti).
- **IAP**: In-App Purchase one-time (acquisto singolo, non abbonamento). Gestito tramite RevenueCat.
- **Product_ID**: Identificatore univoco di un IAP, registrato su Play Console e RevenueCat prima di essere referenziato nel codice.
- **Entitlement**: Diritto RevenueCat collegato a un Product_ID con lo stesso nome semantico.
- **PDF_Engine**: Modulo `pdf-utils.ts` responsabile della generazione HTML→PDF, attualmente usato dalle Fatture.
- **Excel_Engine**: Modulo dedicato all'esportazione in formato `.xlsx`, da creare per le Note spese.
- **Rate_Limit_Engine**: File `rate-limit-engine.ts` che implementa la logica freemium attuale (contatori mensili, boost ads). Soggetto a vincolo di perimetro protetto.
- **PlanContext**: Context React (`PlanContext.tsx`) che espone `PlanLimits` e `isPremium`. Soggetto a vincolo di perimetro protetto.
- **Rubrica**: La sezione Rubrica clienti, che centralizza i dati dei clienti condivisi da tutte le sezioni.
- **Notification_Service**: Modulo `notifications-service.ts` che gestisce le notifiche push locali.
- **Tab_Bar**: Barra di navigazione inferiore a tab dell'app (`_layout.tsx` in `(tabs)/`).
- **SdI_Partner**: Servizio esterno per l'invio di fatture al Sistema di Interscambio tramite affiliazione, senza Product_ID interno.

---

## Requirements

### Requirement 1: Perimetro Protetto — Nessuna Modifica a PlanContext e Rate_Limit_Engine

**User Story:** As a developer, I want the migration to the new monetization model to leave the `organizations.plan`, `user_plan.plan` fields and the Rate_Limit_Engine logic untouched, so that existing users remain stable during the transition.

#### Acceptance Criteria

1. THE VELA_App SHALL mantenere inalterato lo schema delle colonne `organizations.plan` e `user_plan.plan` su Supabase durante tutto il ciclo di vita del pivot.
2. THE Rate_Limit_Engine SHALL mantenere invariata la propria interfaccia pubblica (`fetchPlanLimits`, `checkLimit`, `applyBoost`, `PlanLimits`, `ResourceType`, `CheckLimitResult`).
3. THE PlanContext SHALL mantenere invariata la propria interfaccia pubblica (`PlanContextValue`, `usePlan()`).
4. IF una nuova sezione richiede un controllo di accesso basato su IAP, THEN THE VELA_App SHALL implementare tale controllo in un modulo separato da Rate_Limit_Engine, senza modificare i tipi o le funzioni esistenti.
5. THE VELA_App SHALL NON introdurre nessuna forma di rate-limit — contatore, flag, cooldown o delay — su nessuna delle cinque sezioni del prodotto.

---

### Requirement 2: Navigazione Multi-Sezione — Tab Bar a 5+ Voci

**User Story:** As a professional, I want to access all five sections of my notebook from a persistent navigation bar, so that I can quickly move between Fatture, Preventivi, Note spese, Promemoria, and Rubrica.

#### Acceptance Criteria

1. THE Tab_Bar SHALL esporre almeno cinque tab nell'ordine: Dashboard, Fatture, Preventivi, Note spese, Promemoria scadenze.
2. WHEN l'utente preme un tab, THE Tab_Bar SHALL navigare alla schermata radice della sezione corrispondente senza perdere lo stato delle altre sezioni.
3. THE Tab_Bar SHALL utilizzare icone Ionicons semanticamente coerenti con il contenuto di ciascuna sezione.
4. THE Tab_Bar SHALL mantenere la Rubrica clienti accessibile come sezione dedicata navigabile dalla Tab_Bar o da un entry point fisso e sempre visibile nell'UI.
5. WHERE la Rubrica è implementata come tab separato, THE Tab_Bar SHALL includere un tab aggiuntivo per la Rubrica.
6. THE Tab_Bar SHALL applicare gli stili esistenti (`tabBarStyle`, `tabBarActiveTintColor`, `tabBarInactiveTintColor`) a tutti i nuovi tab.

---

### Requirement 3: Sezione Fatture — Preservazione Funzionalità Esistente

**User Story:** As a professional, I want the Fatture section to continue working exactly as before the pivot, so that I don't lose my productivity during and after the migration.

#### Acceptance Criteria

1. THE VELA_App SHALL mantenere inalterata la navigazione esistente verso `app/(app)/(tabs)/invoices.tsx`, `app/(app)/invoices/new.tsx` e `app/(app)/[invoice].tsx`.
2. THE PDF_Engine SHALL generare PDF di fatture con lo stesso output visivo e gli stessi campi del comportamento attuale.
3. WHEN una nuova sezione riutilizza il PDF_Engine, THE PDF_Engine SHALL produrre output corretto per entrambe le sezioni senza regressioni sui PDF di Fatture.
4. THE VELA_App SHALL NON modificare le API route esistenti (`/api/invoices/*`) come effetto collaterale dell'aggiunta delle nuove sezioni.

---

### Requirement 4: Sezione Preventivi — Generazione PDF

**User Story:** As a professional, I want to create PDF quotes to send to clients before issuing an invoice, so that I can formalize my commercial proposals.

#### Acceptance Criteria

1. THE VELA_App SHALL fornire una sezione Preventivi accessibile dalla Tab_Bar con schermata lista, schermata creazione e schermata dettaglio.
2. WHEN l'utente crea un preventivo, THE VELA_App SHALL permettere di selezionare un cliente dalla Rubrica, aggiungere voci con descrizione/quantità/prezzo, e specificare una data di validità.
3. THE PDF_Engine SHALL generare un PDF di preventivo con intestazione "PREVENTIVO" e campo "Valido fino al" al posto di "Scadenza pagamento".
4. THE VELA_App SHALL permettere la conversione di un preventivo con stato "accettato" in una fattura, pre-compilando il form fattura con i dati del preventivo.
5. IF l'utente ha acquistato l'entitlement `vela.logo.custom`, THEN THE PDF_Engine SHALL includere il logo del professionista nel PDF del preventivo.
6. THE VELA_App SHALL salvare i preventivi in una tabella Supabase dedicata (`quotes`) separata da `invoices`.
7. THE VELA_App SHALL NON applicare nessun rate-limit alla creazione di preventivi.

---

### Requirement 5: Sezione Note Spese — PDF ed Export Excel

**User Story:** As a professional, I want to record my business expenses and export them as PDF or Excel, so that I have a ready report for my accountant.

#### Acceptance Criteria

1. THE VELA_App SHALL fornire una sezione Note spese accessibile dalla Tab_Bar con schermata lista, schermata creazione e schermata dettaglio.
2. WHEN l'utente crea una nota spesa, THE VELA_App SHALL permettere di inserire data, categoria, importo, valuta e descrizione opzionale.
3. THE PDF_Engine SHALL generare un PDF di nota spesa con lista delle voci di spesa, totale per categoria e totale complessivo.
4. WHEN l'utente richiede l'export Excel di una o più note spese, THE Excel_Engine SHALL generare un file `.xlsx` con una riga per voce di spesa, colonne per data/categoria/importo/descrizione e riga di totale.
5. IF l'utente NON ha acquistato l'entitlement `vela.export.excel`, THEN THE VELA_App SHALL mostrare un paywall IAP per `vela.export.excel` al momento della richiesta di export Excel, senza generare il file.
6. WHEN l'utente richiede esplicitamente l'export Excel E ha acquistato l'entitlement `vela.export.excel`, THE Excel_Engine SHALL generare il file `.xlsx` e avviare la condivisione nativa; IF la condivisione nativa fallisce, THEN THE VELA_App SHALL rendere il file accessibile tramite un metodo alternativo (es. copia nel file system del dispositivo) senza bloccare l'utente.
7. THE VELA_App SHALL NON applicare nessun rate-limit alla creazione di note spese.

---

### Requirement 6: Sezione Promemoria Scadenze — Notifiche In-App

**User Story:** As a professional, I want to set reminders for deadlines (expected payments, tax filings, renewals) and receive in-app notifications, so that I never miss critical business deadlines.

#### Acceptance Criteria

1. THE VELA_App SHALL fornire una sezione Promemoria accessibile dalla Tab_Bar con schermata lista promemoria e schermata creazione.
2. WHEN l'utente crea un promemoria, THE VELA_App SHALL permettere di inserire titolo, data di scadenza, note opzionali e un flag di ripetizione (una volta / mensile / annuale).
3. WHEN la data di scadenza di un promemoria è raggiunta, THE Notification_Service SHALL inviare una notifica push locale al dispositivo con il titolo del promemoria.
4. THE VELA_App SHALL NON generare nessun PDF per la sezione Promemoria.
5. WHEN l'utente apre la sezione Promemoria per la prima volta E il permesso notifiche non è ancora stato concesso, THE Notification_Service SHALL richiedere il permesso di invio notifiche.
6. IF l'utente nega il permesso notifiche, THEN THE VELA_App SHALL mostrare un avviso in-app che spiega come abilitarle manualmente dalle impostazioni del dispositivo.
7. THE VELA_App SHALL NON applicare nessun rate-limit alla creazione di promemoria.

---

### Requirement 7: Rubrica Clienti — Dati Condivisi tra Sezioni

**User Story:** As a professional, I want to manage a single client address book used by all sections, so that I don't have to re-enter client data every time I create an invoice, a quote, or an expense report.

#### Acceptance Criteria

1. THE Rubrica SHALL esporre un'interfaccia di selezione cliente riutilizzabile da Fatture, Preventivi e Note spese.
2. WHEN l'utente seleziona un cliente dalla Rubrica in una sezione, THE VELA_App SHALL pre-compilare automaticamente i campi cliente del documento corrente.
3. THE Rubrica SHALL permettere di creare, modificare ed eliminare clienti con i campi: nome, email, P.IVA, indirizzo, telefono, valuta predefinita.
4. THE VELA_App SHALL NON applicare nessun rate-limit alla creazione di clienti nella Rubrica.
5. THE Rubrica SHALL essere accessibile sia come sezione dedicata sia tramite un picker inline nei form delle altre sezioni.
6. WHEN un cliente viene eliminato dalla Rubrica, THE VELA_App SHALL mantenere i dati del cliente nei documenti già esistenti che lo referenziano (snapshot al momento della creazione del documento).

---

### Requirement 8: Pivot Naming — Rimozione di "Fattura" come Nome del Prodotto

**User Story:** As a VELA user, I want the app to present itself as a "professional's notebook" and not as a "invoice generator", so that I understand I can use it for much more than just invoices.

#### Acceptance Criteria

1. THE VELA_App SHALL aggiornare il titolo dell'app e tutti i copy di onboarding dove "fattura/e" è usato come sinonimo del prodotto intero, sostituendolo con "VELA", "documento" o il nome della sezione pertinente.
2. THE VELA_App SHALL mantenere invariati i testi UI dove "fattura/e" si riferisce correttamente alla sezione Fatture (es. "Nuova Fattura", "Elimina fattura", filtri di stato).
3. WHEN una sezione non-Fatture mostra uno stato vuoto, THE VELA_App SHALL visualizzare testi specifici per quella sezione, NON testi generici riferiti alle fatture.
4. THE VELA_App SHALL aggiornare i testi del paywall per riflettere il nuovo valore del prodotto multi-sezione, rimuovendo riferimenti a "fatture illimitate" come unico beneficio principale.
5. WHEN viene modificato un testo i18n che contiene "fattura" come nome di prodotto, THE VELA_App SHALL aggiornare la chiave corrispondente in tutti i file locale presenti in `lib/locales/`.

---

### Requirement 9: Monetizzazione IAP — Acquisti One-Time

**User Story:** As the VELA team, I want to monetize specific features through one-time IAPs on RevenueCat, so that the core product is free and unlimited and users are converted with clear perceived value.

#### Acceptance Criteria

1. THE VELA_App SHALL implementare quattro Product_ID IAP: `vela.template.premium`, `vela.logo.custom`, `vela.export.excel`, `vela.backup.cloud`, ciascuno con un entitlement RevenueCat di nome semanticamente equivalente.
2. THE VELA_App SHALL referenziare i Product_ID nel codice SOLO dopo che sono stati creati su Play Console e registrati su RevenueCat.
3. WHEN l'utente tenta di usare una feature protetta da IAP senza averla acquistata, THE VELA_App SHALL presentare un paywall contestuale con descrizione del beneficio e pulsante di acquisto.
3. WHEN l'acquisto di un IAP è completato con successo, THE VELA_App SHALL sbloccare immediatamente la feature corrispondente senza richiedere riavvio dell'app, in tutti i casi senza eccezioni.
5. THE VELA_App SHALL implementare un flusso di ripristino acquisti accessibile dalle impostazioni, che re-attivi tutti gli entitlement già acquistati.
6. IF la verifica dell'entitlement RevenueCat fallisce per errore di rete, THEN THE VELA_App SHALL utilizzare la cache locale dell'ultimo stato noto degli entitlement e mostrare un avviso non bloccante.
7. THE VELA_App SHALL NON condizionare la creazione di documenti (fatture, preventivi, note spese, promemoria) all'acquisto di nessun IAP.

---

### Requirement 10: IAP — Template Premium (vela.template.premium)

**User Story:** As a professional, I want to apply a premium PDF template to my invoices, so that my documents look more professional and personalized.

#### Acceptance Criteria

1. THE VELA_App SHALL fornire almeno un template PDF alternativo a quello di default per la sezione Fatture.
2. WHEN l'utente accede alla selezione template senza aver acquistato `vela.template.premium`, THE VELA_App SHALL mostrare i template premium con anteprima bloccata e paywall di acquisto.
3. WHEN il PDF della fattura viene generato E l'utente ha acquistato l'entitlement `vela.template.premium` E ha selezionato un template premium, THEN THE PDF_Engine SHALL applicare il template selezionato durante la fase di generazione del PDF.
4. THE VELA_App SHALL verificare l'entitlement `vela.template.premium` tramite RevenueCat al momento della selezione del template, NON al momento della generazione del PDF.

---

### Requirement 11: IAP — Logo Personalizzato (vela.logo.custom)

**User Story:** As a professional, I want to add my logo to PDF invoices and quotes, so that my documents are immediately recognizable as mine.

#### Acceptance Criteria

1. THE VELA_App SHALL permettere il caricamento di un logo da libreria immagini del dispositivo o fotocamera.
2. WHEN l'utente tenta di caricare o attivare il logo senza aver acquistato `vela.logo.custom`, THE VELA_App SHALL mostrare il paywall IAP per `vela.logo.custom`.
3. THE VELA_App SHALL permettere il caricamento e l'anteprima del logo senza acquisto; IF il PDF viene generato E l'utente non ha acquistato l'entitlement `vela.logo.custom`, THEN THE PDF_Engine SHALL NON includere il logo nel PDF.
4. IF l'utente ha acquistato l'entitlement `vela.logo.custom`, THEN THE PDF_Engine SHALL includere il logo nell'header del PDF di fatture e preventivi.
5. THE VELA_App SHALL rifiutare il caricamento di un logo con dimensione superiore a 5 MB, indipendentemente dal formato.
6. THE VELA_App SHALL accettare loghi in formato PNG, JPG o WebP con dimensione massima di 5 MB.
7. THE VELA_App SHALL salvare il logo caricato in modo persistente sul dispositivo e associarlo al profilo del professionista.

---

### Requirement 12: IAP — Backup Cloud (vela.backup.cloud)

**User Story:** As a professional, I want all my data (invoices, quotes, expenses, reminders, address book) to be synced and backed up in the cloud, so that I don't lose them when changing or resetting my device.

#### Acceptance Criteria

1. THE VELA_App SHALL fornire una feature di backup cloud che copre tutte e cinque le sezioni del prodotto.
2. WHEN l'utente attiva il backup cloud senza aver acquistato `vela.backup.cloud`, THE VELA_App SHALL mostrare il paywall IAP per `vela.backup.cloud`.
3. IF l'utente ha acquistato l'entitlement `vela.backup.cloud`, THEN THE VELA_App SHALL sincronizzare automaticamente i dati dell'utente su Supabase in background ad ogni modifica.
4. WHEN l'utente esegue il login su un nuovo dispositivo dopo aver acquistato l'entitlement `vela.backup.cloud`, THEN THE VELA_App SHALL ripristinare completamente i dati dell'utente da Supabase.

---

### Requirement 13: IAP — Invio a SdI tramite Partner Esterno (Affiliazione)

**User Story:** As an Italian professional, I want to send my electronic invoices to the Sistema di Interscambio through VELA, so that I can fulfil the electronic invoicing obligation without leaving the app.

#### Acceptance Criteria

1. THE VELA_App SHALL esporre nella sezione Fatture un entry point per l'invio a SdI tramite SdI_Partner in affiliazione.
2. THE VELA_App SHALL NON gestire internamente nessun Product_ID IAP per questa feature (il flusso è gestito interamente dal SdI_Partner esterno).
3. WHEN l'utente seleziona "Invia a SdI", THE VELA_App SHALL aprire il flusso del SdI_Partner tramite deep link o WebView dedicata.
4. THE VELA_App SHALL presentare chiaramente che il servizio SdI è fornito da un partner terzo e che il completamento avviene fuori dall'ecosistema VELA.

---

### Requirement 14: PDF_Engine — Astrazione Multi-Documento

**User Story:** As a developer, I want the PDF generation module to be parameterizable by document type (invoice, quote, expense report), so that I avoid code duplication and maintain a single template base to update.

#### Acceptance Criteria

1. THE PDF_Engine SHALL accettare un parametro `documentType` con valori `'invoice' | 'quote' | 'expense_report'` che condiziona intestazione, campi e layout del PDF generato.
2. THE PDF_Engine SHALL accettare opzionalmente un parametro `logoUrl` che, se presente, aggiunge il logo nell'header del documento.
3. THE PDF_Engine SHALL accettare opzionalmente un parametro `templateId` che seleziona il layout tra quelli disponibili.
4. WHEN il `documentType` è `'invoice'`, THE PDF_Engine SHALL produrre output identico al comportamento attuale; IF la retrocompatibilità non può essere mantenuta, THEN THE PDF_Engine SHALL generare un errore e interrompere la generazione.
5. WHEN il `documentType` è `'quote'`, THE PDF_Engine SHALL sostituire l'etichetta "FATTURA" con "PREVENTIVO" e il campo scadenza con "Valido fino al"; WHILE il comportamento comune a tutti i tipi di documento è coerente, THE PDF_Engine SHALL mantenere la compatibilità con il formato invoice nei campi condivisi.
6. WHEN il `documentType` è `'expense_report'`, THE PDF_Engine SHALL generare una tabella di voci di spesa con colonne data/categoria/importo/descrizione e righe di subtotale per categoria.
7. THE PDF_Engine SHALL esporre tipi TypeScript dedicati per i dati di input di ciascun `documentType` (es. `QuoteData`, `ExpenseReportData`) senza modificare il tipo `Invoice` esistente.

---

### Requirement 15: Fase A1 — Mappa Naming "Fattura" come Nome Prodotto vs Sezione

**User Story:** As a developer, I want a documented map of all code/copy locations where "fattura" is used as the product name, so that I can perform the naming pivot in a targeted and safe way.

#### Acceptance Criteria

1. THE VELA_App SHALL identificare tutti i testi i18n nelle chiavi di `lib/locales/` dove "fattura/e" è usato come sinonimo del prodotto (es. `login.subtitle`, `modal.pro_upgrade.subtitle`, testi di onboarding).
2. THE VELA_App SHALL identificare tutti i testi hardcoded nei file `.tsx` dove "fattura/e" descrive l'app intera anziché la sezione.
3. THE VELA_App SHALL produrre due liste separate: occorrenze da aggiornare (naming prodotto) e occorrenze da mantenere (naming sezione).

---

### Requirement 16: Fase A2 — Punti di Aggancio Navigazione Nuove Sezioni

**User Story:** As a developer, I want to know exactly where and how to attach the new sections to the existing navigation infrastructure, so that I can proceed with the implementation without architectural ambiguities.

#### Acceptance Criteria

1. THE VELA_App SHALL aggiungere i nuovi tab in `app/(app)/(tabs)/_layout.tsx` seguendo il pattern `<Tabs.Screen>` esistente.
2. THE VELA_App SHALL creare i file di route `app/(app)/(tabs)/expenses.tsx` e `app/(app)/(tabs)/reminders.tsx` per le nuove sezioni.
3. THE VELA_App SHALL creare le sottocartelle CRUD: `app/(app)/expenses/new.tsx`, `app/(app)/expenses/[id].tsx`, `app/(app)/reminders/new.tsx`, `app/(app)/reminders/[id].tsx`.
4. THE VELA_App SHALL aggiornare le chiavi i18n per i titoli dei nuovi tab in tutti i file locale.
5. THE Rubrica SHALL essere accessibile dalla Tab_Bar come tab `app/(app)/(tabs)/contacts.tsx`, riutilizzando la logica della tab `clients` esistente come base.

---

### Requirement 17: Fase A3 — Piano Retrocompatibilità PDF_Engine

**User Story:** As a developer, I want a technical plan defining the minimal changes to PDF_Engine to support Quotes and Expense Reports, so that I can implement safely without breaking Invoices.

#### Acceptance Criteria

1. THE PDF_Engine SHALL essere modificato aggiungendo il parametro `documentType` senza rimuovere o alterare la firma della funzione `generateInvoicePDF` esistente.
2. THE PDF_Engine SHALL introdurre la funzione `generateDocumentPDF(data: DocumentData, options: PDFGenerationOptions): Promise<string | null>` come nuovo entry point unificato, lasciando `generateInvoicePDF` come wrapper per retrocompatibilità.
3. THE VELA_App SHALL NON modificare nessuna chiamata esistente a `generateInvoicePDF` o `shareInvoicePDF` come effetto collaterale dell'aggiunta del nuovo entry point.

---

### Requirement 18: Rebrand — Sostituzione di "VELA" con "Milo Office" nell'UI e nei Documenti Generati

**User Story:** As a Milo Office user, I want to see the correct product name "Milo Office" everywhere the app presents itself — in the UI, in the generated documents, and in the app metadata — so that the brand is consistent and professional.

#### Acceptance Criteria

1. THE VELA_App SHALL aggiornare tutte le chiavi i18n in `lib/locales/*.ts` dove il valore contiene la stringa "VELA" o "Vela" usata come nome del prodotto, sostituendola con "Milo Office".
2. THE VELA_App SHALL aggiornare tutti i testi hardcoded nei file `.tsx` e `.ts` dove "VELA" o "Vela" appare come nome visibile del prodotto verso l'utente finale.
3. WHEN il PDF_Engine genera un documento (fattura, preventivo, nota spese), THE PDF_Engine SHALL includere "Milo Office" — e non "VELA" o "Vela" — come riferimento al prodotto nei metadati e nell'eventuale footer del documento generato.
4. WHEN un template DOC, ODT o RTF viene prodotto dal Document_Format_Engine, THE Document_Format_Engine SHALL includere "Milo Office" nei metadati del file (author, generator o campo equivalente) e non "VELA".
5. THE VELA_App SHALL mantenere invariati: il package name Android, l'application ID, il bundle identifier iOS e i nomi delle tabelle del database Supabase.
6. THE VELA_App SHALL mantenere invariati tutti gli identificatori tecnici interni (nomi di variabili, funzioni, moduli, chiavi AsyncStorage, Product_ID IAP) che contengono il prefisso "vela" in minuscolo — il rebrand riguarda esclusivamente i testi visibili all'utente.
7. WHEN viene modificato un testo che contiene "VELA"/"Vela" come nome prodotto, THE VELA_App SHALL aggiornare la chiave corrispondente in tutti i file locale presenti in `lib/locales/` in modo coerente.

---

### Requirement 19: Generazione Documenti Multi-Formato (PDF / DOC / ODT / RTF)

**User Story:** As a professional, I want to choose the output format of my documents (PDF, DOC, ODT, RTF) before generating them, so that I can share files in the format most suitable for my recipients.

#### Acceptance Criteria

1. THE Document_Format_Engine SHALL supportare quattro formati di output: `pdf`, `doc`, `odt`, `rtf`.
2. WHEN l'utente richiede la generazione di un documento (fattura, preventivo, nota spese), THE VELA_App SHALL presentare una selezione esplicita del formato di output tra i quattro formati supportati prima di avviare la generazione.
3. THE VELA_App SHALL NON applicare un formato di default silenzioso: la selezione del formato deve richiedere un'azione esplicita dell'utente ad ogni generazione, oppure persistere l'ultima scelta dell'utente come default pre-selezionato ma modificabile.
4. WHEN l'utente conferma la generazione, THE Document_Format_Engine SHALL produrre un file nel formato dichiarato; IF il formato selezionato è `doc`, THEN il file generato SHALL essere un file DOC/DOCX realmente apribile in un word processor, NON un file PDF rinominato con estensione `.doc`.
5. IF il formato selezionato è `odt`, THEN il file generato SHALL essere un file ODT realmente apribile in LibreOffice o applicazioni compatibili OpenDocument, NON un file PDF rinominato.
6. IF il formato selezionato è `rtf`, THEN il file generato SHALL essere un file RTF realmente apribile in editor di testo compatibili RTF, NON un file PDF rinominato.
7. WHEN la generazione di un documento è completata, THE Document_Format_Engine SHALL rendere il file disponibile per la condivisione nativa entro 4 secondi dalla conferma dell'utente, misurati sul dispositivo di riferimento (mid-range Android).
8. THE Document_Format_Engine SHALL esporre un sistema di template riutilizzabile tra i quattro formati, in modo che la struttura del documento (intestazione, voci, totali, footer) sia definita una sola volta e renderizzata in ciascun formato da un renderer dedicato.
9. IF la generazione nel formato selezionato fallisce, THEN THE VELA_App SHALL notificare l'utente con un messaggio di errore comprensibile e NON produrre un file parziale o corrotto.
10. THE VELA_App SHALL NON applicare nessun rate-limit alla generazione di documenti in qualsiasi formato.

---

### Requirement 20: Freemium a Quota — Contatore Documenti Generati (Piano Gratuito)

**User Story:** As the Milo Office team, I want to limit the total number of documents that free-plan users can generate, so that I can incentivize upgrades to premium without introducing time-based rate limits.

#### Acceptance Criteria

1. THE Quota_Engine SHALL tracciare il numero totale di documenti generati da un utente del piano gratuito attraverso un contatore persistito sul backend Supabase, in un modulo separato (`quota-engine.ts`) che NON modifica `Rate_Limit_Engine`, `PlanContext`, `organizations.plan` o `user_plan.plan`.
2. THE Quota_Engine SHALL NON introdurre nessun rate-limit temporale (nessun reset mensile, nessun cooldown, nessun contatore per unità di tempo).
3. WHEN un utente del piano gratuito tenta di generare un documento E il contatore totale ha raggiunto la soglia configurata, THE VELA_App SHALL bloccare la generazione e mostrare un paywall verso il piano premium.
4. THE Quota_Engine SHALL leggere la soglia massima da una configurazione centralizzata; il valore di default è 5 documenti totali, soggetto a conferma da parte del team (da aggiornare prima del rilascio).
5. IF l'utente ha un piano premium attivo (verificato tramite RevenueCat), THEN THE Quota_Engine SHALL NON applicare nessun limite al numero di documenti generabili.
6. THE Quota_Engine SHALL mantenere il contatore di documenti generati lato backend (Supabase) in modo che non sia aggirabile tramite operazioni lato client (es. cancellazione della cache locale, reinstallazione dell'app).
7. WHEN un documento viene generato con successo, THE Quota_Engine SHALL incrementare il contatore atomicamente su Supabase prima di restituire il file all'utente.
8. THE Quota_Engine SHALL esporre all'UI il numero di documenti rimanenti nel piano gratuito, in modo che l'utente possa vedere quanti ne ha ancora a disposizione.
9. THE Quota_Engine SHALL integrarsi con il sistema RevenueCat/billing esistente come unica fonte di verità per la verifica del piano premium; THE Quota_Engine SHALL NON introdurre una seconda fonte di verità per lo stato del piano.
10. THE VELA_App SHALL NON modificare i moduli `Rate_Limit_Engine`, `PlanContext`, `organizations.plan`, `user_plan.plan` come effetto collaterale dell'implementazione del Quota_Engine.

---

### Requirement 21: Traduttore Contenuti Integrato — Gemini Flash

**User Story:** As a professional, I want to translate the content of my documents (descriptions, notes, titles) into another language using an integrated AI translator, so that I can serve international clients without leaving the app.

#### Acceptance Criteria

1. THE Translation_Service SHALL permettere all'utente di selezionare una lingua di destinazione tra un insieme di lingue supportate prima di avviare la traduzione.
2. WHEN l'utente avvia la traduzione di un documento, THE Translation_Service SHALL inviare i campi di testo inseriti dall'utente (descrizioni delle voci, note, titolo del documento) all'API Gemini Flash per la traduzione nella lingua selezionata.
3. THE Translation_Service SHALL tradurre esclusivamente i contenuti inseriti dall'utente (descrizioni voci, note, titoli); THE Translation_Service SHALL NON tradurre l'interfaccia dell'applicazione, le etichette dei campi, i testi di sistema o i valori numerici.
4. WHEN la traduzione è completata, THE VELA_App SHALL rigenerare il documento nel formato di output già selezionato dall'utente (secondo Requirement 19), sostituendo i testi originali con i testi tradotti.
5. THE VELA_App SHALL etichettare l'output tradotto con un'indicazione visibile "Traduzione automatica" nei metadati del documento generato o in un'area visibile del documento stesso, senza promettere qualità di traduzione professionale.
6. IF l'API Gemini Flash non è raggiungibile o restituisce un errore, THEN THE VELA_App SHALL notificare l'utente con un messaggio comprensibile e mantenere il documento con i testi originali non tradotti, senza bloccare il flusso di generazione.
7. THE Translation_Service SHALL verificare se il client API Gemini Flash è già integrato nel progetto; IF non è ancora integrato, THEN THE VELA_App SHALL aggiungere l'integrazione come dipendenza esplicita prima di implementare il servizio di traduzione.
8. THE Translation_Service SHALL NON inviare all'API Gemini Flash dati sensibili dell'utente non pertinenti alla traduzione (es. credenziali, dati di pagamento, identificatori di sessione).
9. THE VELA_App SHALL NON applicare nessun rate-limit alla funzionalità di traduzione come effetto collaterale dei moduli di quota o rate-limit esistenti.
10. WHEN l'utente richiede la traduzione di un documento vuoto o con tutti i campi testuali vuoti, THE Translation_Service SHALL notificare l'utente che non vi sono contenuti da tradurre, senza effettuare chiamate all'API esterna.
