# Milo Office — Play Store Listing 🇮🇹

Sostituisce gli asset legacy in `frontend/public/playstore/` (README di
quella cartella dichiara esplicitamente "TWA per InvoiceStudio" — un
prodotto/pivot abbandonato, brand e dimensioni sbagliate per l'app nativa
attuale). Questi asset sono per l'app nativa Expo/React Native
`com.Invoice_Studio.myapp`, iOS `com.vela.mobile`.

## Nome App
**Milo Office — Fatture, Preventivi, PDF** (max 50 caratteri)

## Short Description (max 80 caratteri)
Fatture, preventivi, spese e promemoria. Genera PDF professionali in pochi secondi.

## Full Description

Milo Office è l'app per freelancer e piccole attività che vogliono creare
fatture, preventivi e documenti professionali senza complicazioni.

📄 **Documenti PDF in pochi secondi**
Crea fatture e preventivi professionali con calcolo automatico di IVA e
ritenuta d'acconto. Anteprima immediata, esportazione e condivisione PDF.

💰 **Gestione spese**
Registra le spese aziendali e tieni sotto controllo la contabilità.

🔔 **Promemoria automatici**
Non dimenticare mai una scadenza: reminder automatici per fatture e pagamenti.

👥 **Rubrica clienti**
Gestisci i tuoi clienti con anagrafica completa e storico documenti.

🇮🇹 **100% italiano**
Interfaccia e fiscali in italiano, pensata per regime forfettario e ordinario.

🆓 **Piano gratuito disponibile**
Usa Milo Office gratis, con pubblicità supportata da Google AdMob (previo
consenso GDPR/UMP). Passa al piano Pro per rimuovere la pubblicità e
sbloccare tutte le funzionalità.

## Categoria
Business → Finance & Accounting / Productivity

## Tags
fatture, preventivi, freelancer, partita iva, fatturazione, PDF, italia,
forfettario, ritenuta d'acconto, spese, promemoria

## Privacy Policy URL
https://milo.mindprint.it/privacy
(IT/EN — verificata raggiungibile, ora dichiara esplicitamente Google AdMob
come responsabile del trattamento — v. frontend/src/app/privacy/page.tsx)

## Terms of Service URL
https://milo.mindprint.it/terms

## Support Email
⚠️ NON TROVATO nel repository — nessun indirizzo email di supporto è
referenziato da nessuna parte (grep su mobile/ e frontend/src/app/privacy,
en/privacy). Play Console richiede un contatto di supporto valido:
va fornito da POSKY prima della pubblicazione, non inventato qui.

## Note per la pubblicazione
- App ID AdMob: ca-app-pub-8156953772676654~4738629818 (verificato in
  mobile/app.json — v. audit precedente).
- L'app richiede il permesso AD_ID e mostra annunci (interstitial +
  banner + rewarded) solo agli utenti free, dietro consenso UMP.
- Asset in questa cartella generati da
  `/tmp/.../scratchpad/gen_store_assets.py` (PIL puro — sharp non era
  disponibile nel sandbox) a partire dall'icona fornita dall'utente
  (`~/Scaricati/photo_6026138707896765705_y.jpg`), con lo sfondo bianco
  del file originale sostituito dal colore reale dell'app (#0a0b0f).
