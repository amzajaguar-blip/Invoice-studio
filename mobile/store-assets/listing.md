# Milo Office — Play Store Listing 🇮🇹

Sostituisce gli asset legacy in `frontend/public/playstore/` (README di
quella cartella dichiara esplicitamente "TWA per InvoiceStudio" — un
prodotto/pivot abbandonato, brand e dimensioni sbagliate per l'app nativa
attuale). Questi asset sono per l'app nativa Expo/React Native
`com.Invoice_Studio.myapp`, iOS `com.vela.mobile`.

## Nome App
**Milo Office — Scanner e Generatore Documenti** (39 caratteri, max 50)

## Short Description (max 80 caratteri — 70 usati)
Scatta una foto, ottieni PDF, Word o Excel in pochi secondi. Semplice.

## Full Description (max 4000 caratteri — 1761 usati)

Milo Office trasforma una foto o un'idea in un documento pronto in pochi secondi. Fotografa un foglio, un appunto o una ricevuta: Milo Office ne estrae il testo, te lo mostra modificabile e lo trasforma nel formato che ti serve — PDF, Word, Excel o RTF. Oppure parti da zero, scrivi il contenuto e genera il file direttamente.

📸 **Scansiona e genera**
Scatta una foto con la fotocamera, correggi il testo riconosciuto se serve, poi scegli il formato di output. Nessun passaggio manuale di ricopiatura.

✍️ **Scrivi e genera**
Non hai un foglio da fotografare? Scrivi direttamente il contenuto e ottieni comunque un PDF, un Word, un Excel o un RTF pronto da condividere.

📊 **Report e andamento**
Dashboard con documenti creati, bozze convertite ed export generati, per capire a colpo d'occhio quanto stai producendo.

🗂️ **Tutti i file in un posto**
Ritrova ogni PDF, Word o Excel generato, con stato e data, senza scavare tra le cartelle del telefono.

👥 **Rubrica e organizzazione**
Tieni anche una rubrica clienti, traccia le spese e imposta promemoria per le scadenze che non vuoi dimenticare.

🌍 **Disponibile in 7 lingue**
Italiano, inglese, spagnolo, francese, tedesco, portoghese e cinese, con un'interfaccia coerente in ogni lingua.

🆓 **Gratis per iniziare**
Milo Office si usa gratis, con un numero di documenti mensili incluso. Serve di più questo mese? Guarda un breve annuncio per sbloccare un Business Boost temporaneo (richiede consenso alla pubblicità personalizzata secondo le norme GDPR/UMP).

⭐ **Milo Office Pro**
Passa a Pro per rimuovere tutta la pubblicità e sbloccare documenti illimitati, oltre alle statistiche avanzate.

Milo Office è pensato per chiunque debba produrre documenti al volo senza aprire un computer: dalla foto al file condiviso, tutto dal telefono.

## Categoria
Productivity / Business

## Tags
scanner documenti, OCR, generatore PDF, Word, Excel, RTF, produttività,
freelancer, rubrica clienti, spese, promemoria

## Nota sul cambio di posizionamento (seconda revisione di questo file)
Prima versione di questo testo (v. cronologia file): parlava di fatture/
preventivi come funzionalità di punta, con IVA e "ritenuta d'acconto" — scritta
leggendo i file presenti nel repo, non la UI reale mostrata all'utente.
Seconda versione: ancora centrata su "Fatture e preventivi" come bullet di
punta, con IVA citata due volte.

Questa terza versione toglie fatture/preventivi/IVA dal testo perché **non
sono più superficie di prodotto**: la tab bar reale
(`mobile/app/(app)/(tabs)/_layout.tsx`) ha solo Dashboard/Files/Settings,
le rotte fattura/preventivo sono `href: null` (raggiungibili solo per
compatibilità con link vecchi, non promosse), e il flusso primario
(`scanner.tsx`, `generate.tsx`) non ha nessun campo IVA visibile all'utente.
Dettagli completi e riferimenti ai commit in `mobile/CLAUDE.md` — leggerlo
prima di reintrodurre linguaggio da fatturazione in qualunque copy o UI.

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
- Icona (`icon-512.png`) e feature graphic generati da
  `/tmp/.../scratchpad/gen_store_assets.py` (PIL puro) a partire dall'icona
  fornita dall'utente, con lo sfondo bianco del file originale sostituito
  dal colore reale dell'app (#0a0b0f).
- `screenshot-1/2/3.png`: sostituiscono i 4 mockup PIL precedenti (astratti,
  non rappresentavano UI reale). Sono grafiche promozionali fornite
  dall'utente (mockup con cornice telefono + headline, generate con lo
  strumento "Genspark"), ridimensionate/centrate a 1080×1920 senza stirare
  il contenuto. La UI mostrata dentro è reale e coerente col codice attuale
  (tab bar Dashboard/File/Impostazioni, schermata "Genera file" con "Nessun
  cliente, nessuna tassa" — v. `mobile/CLAUDE.md`).
  In `screenshot-3.png` sono stati rimossi via inpainting a gradiente
  (interpolazione verticale tra righe pulite sopra/sotto, nessuna libreria
  esterna): il watermark "Genspark" in basso a destra, e la scritta "Nessun
  abbonamento. Nessuna tassa." che contraddiceva l'abbonamento Pro reale
  dell'app (RevenueCat, `ProUpgrade.tsx`). Solo 3 screenshot presenti
  (minimo Play Console: 2) — un quarto va aggiunto solo se l'utente fornisce
  un'altra grafica reale, non va rigenerato come mockup astratto.
