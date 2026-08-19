# Nota per agenti: Milo Office non è più un'app di fatturazione

Questo file esiste perché un agente (io, in una sessione precedente a questa nota) ha scritto una descrizione per il Play Store che metteva "Fatture e preventivi" come funzionalità di punta, basandosi sui file presenti nel repo invece che sulla UI reale mostrata all'utente. `README.md`, in questa stessa cartella, ha lo stesso problema: descrive ancora l'app come "InvoiceStudio" con uno scanner di scontrini. Nessuno dei due riflette lo stato attuale del prodotto.

## Cosa è successo davvero

L'app si chiamava Invoice Studio ed era un gestionale di fatturazione. Un pivot funzionale, completato e committato su questo branch prima di questa nota (commit `f7466db feat(pivot): spese, promemoria, contatti + paywall quota/IAP`, `1173167 feat(rebrand): pivot funzionale — documents unificati, KPI generici, pulsanti formato diretto`, `432b77e feat(rilascio): il muro cade a 20...`, `0f819ce fix(scanner): la fotocamera non estraeva niente, e cio' che estraeva era una fattura`), l'ha trasformata in un generatore di documenti generico. Il vecchio codice di fatturazione non è stato cancellato: è stato **spento dalla superficie del prodotto** e lasciato solo per compatibilità.

## Cosa mostra davvero l'app oggi

La tab bar reale (`app/(app)/(tabs)/_layout.tsx`) ha **tre** voci: Dashboard, Files, Settings. Tutto il resto — `invoices`, `quotes`, `expenses`, `reminders`, `contacts`, `clients` — è dichiarato con `options={{ href: null }}`, che lo toglie dalla tab bar ma lascia la rotta raggiungibile via `router.push` (il commento nel file lo dice esplicitamente: non rompere i link esistenti). Non sono funzionalità che si promuovono: sono rotte legacy raggiungibili solo internamente.

Il flusso primario è generico, in due punti:
- `app/(app)/scanner.tsx` — foto → OCR (`rawText`, non più campi fattura parsati) → testo modificabile → genera.
- `app/(app)/generate.tsx` — stesso motore, partendo da zero. Il commento in testa al file dice esplicitamente: *"non chiede un cliente, non chiede un'aliquota, non ha stati"*.

Entrambi producono uno dei quattro formati in `FORMAT_ORDER`: **PDF, Excel (xlsx), Word (doc), RTF**. Nessuno dei due ha un campo IVA/aliquota visibile all'utente: il `taxRate: 0` che si trova in `generate.tsx` è un valore fisso richiesto dal tipo dati del motore di generazione condiviso con le vecchie schermate fattura, non un input.

## Cosa NON è stato toccato (e perché è rilevante se tocchi questo codice)

- Le tabelle Supabase `invoices`/`quotes` e le relative migration **non sono state rimosse**. Cancellarle è una decisione distinta, distruttiva e non presa qui.
- Il vecchio motore freemium `lib/rate-limit-engine.ts` (bucket `invoices`/`customers`/`quotes`, tipo `ResourceType`) è ancora vivo e usato da `clients.tsx` per il limite sui clienti — perché "Rubrica" (route `contacts`/`clients`) resta una funzione della app, solo non in tab bar. Il quota generico per la generazione documenti (`scanner.tsx`, `generate.tsx`) passa invece da `lib/quota-engine.ts`, un sistema separato e più nuovo. Non confondere i due: rimuovere `rate-limit-engine.ts` per errore rompe il paywall dei clienti, non quello dei documenti.
- Le schermate `invoices.tsx`, `quotes.tsx`, `[invoice].tsx`, `quotes/new.tsx`, `quotes/[id].tsx` esistono ancora fisicamente nel repo per lo stesso motivo dell'`href: null` sopra: compatibilità con rotte già raggiunte da utenti esistenti.

## Implicazione diretta per chi scrive copy o UI

Non descrivere Milo Office come un'app di fatturazione, non usare "fatture", "preventivi" o "IVA" come funzionalità di punta in store listing, onboarding o dashboard. Il prodotto è: scansiona o scrivi, genera PDF/Word/Excel/RTF. Se serve reintrodurre fatturazione/preventivi come funzionalità di punta, è una decisione di prodotto esplicita da confermare con chi gestisce il progetto — non da dedurre dal codice presente.
