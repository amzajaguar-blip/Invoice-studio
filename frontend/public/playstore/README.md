# Play Store — Asset Grafici per la Distribuzione TWA

Questa cartella contiene le risorse grafiche richieste da Google Play Console
per pubblicare InvoiceStudio come Trusted Web Activity (TWA).

## Immagini Richieste

| File                      | Dimensioni       | Formato | Descrizione                                                                 |
|---------------------------|------------------|---------|-----------------------------------------------------------------------------|
| `icon-playstore.png`      | 512 × 512 px     | PNG     | Icona dell'app su Play Store. Deve essere quadrata, senza padding eccessivo. |
| `feature-graphic.png`     | 1024 × 500 px    | PNG     | Immagine in evidenza nella scheda Play Store. Area sicura testo: 924 × 380. |
| `screenshot-1.png`        | 1080 × 1920 px   | PNG     | Dashboard principale di InvoiceStudio (tema scuro, dati reali).             |
| `screenshot-2.png`        | 1080 × 1920 px   | PNG     | Creazione / modifica di una fattura professionale.                          |
| `screenshot-3.png`        | 1080 × 1920 px   | PNG     | Gestione clienti e panoramica pagamenti.                                    |
| `screenshot-4.png`        | 1080 × 1920 px   | PNG     | (Opzionale) Report, analytics o notifiche.                                  |

> **Nota:** Google Play richiede **almeno 2 screenshot**. Si consiglia di
> caricarne 4 – 8 per coprire tutte le funzionalità principali.

## Linee Guida per i Contenuti

### Icona (512×512)
- Sfondo scuro (`#0a0b0f`) con il logo "IS" o una fattura stilizzata in primo piano.
- Colore accento: `#6c63ff` (viola brand).
- **Niente testo** nell'icona — solo simbolo.
- Forma adattiva: icona con padding del 15 % per il ritaglio automatico di Play Store.

### Feature Graphic (1024×500)
- A sinistra: logo "InvoiceStudio" + payoff "Fatture Professionali per Freelancer".
- A destra: mockup di un'interfaccia (dashboard o fattura) su dispositivo mobile.
- Sfondo sfumato da `#0a0b0f` a `#1a1030`.
- Il testo deve rientrare nell'area sicura di 924 × 380 px (centrata).

### Screenshot (1080×1920, formato verticale)
- **Non usare mockup di dispositivi** — solo interfaccia a schermo intero.
- Ogni screenshot deve raccontare una storia / feature specifica:
  1. **Dashboard** — widget entrate, fatture in attesa, promemoria.
  2. **Nuova fattura** — form di creazione con anteprima live (React PDF).
  3. **Clienti** — elenco clienti con stato pagamenti.
  4. **Pagamenti** — integrazione Stripe, storico transazioni.
  5. **Notifiche** — reminder automatici e gestione scadenze.
  6. **Report** — grafici e analisi finanziarie (se disponibili).

- Usa dati **realistici ma fittizi** (nomi aziende di esempio, importi credibili in €).
- Lingua: tutto il testo visibile deve essere in **italiano**.

## Icone per la PWA / Manifest

Le icone per il manifest.json vanno nella cartella `frontend/public/icons/`:

| File                  | Dimensioni   |
|-----------------------|--------------|
| `icon-192x192.png`    | 192 × 192 px |
| `icon-512x512.png`    | 512 × 512 px |

Queste sono le stesse icone usate per l'installazione PWA su Android e iOS.

## Generazione Automatica

Puoi generare tutte le icone e i mockup con:

```bash
# Usa uno strumento come pwa-asset-generator o sharp-cli
npx pwa-asset-generator \
  logo.svg ./public/icons \
  --background "#0a0b0f" \
  --padding "15%" \
  --icon-only
```

## Checklist Pre-Pubblicazione

- [ ] Icona 512×512 caricata come `icon-playstore.png`
- [ ] Feature graphic 1024×500 caricata
- [ ] Almeno 4 screenshot 1080×1920
- [ ] SHA256 fingerprint corretto in `assetlinks.json`
- [ ] `package_name` in `assetlinks.json` corrisponde al bundle ID dell'app Android
- [ ] Tutti i testi negli screenshot sono in italiano
- [ ] I dati mostrati sono fittizi (nessun dato utente reale)
