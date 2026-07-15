# VELA — Invoice Studio Project History

> Data: 5 Luglio 2026
> Progetto: VELA (ex Invoice Studio) — App Android Expo/React Native per fatture e preventivi
> Build: v35 (ultima: 5 Lug 2026, run 28707139844)

---

## Indice

- [Architettura e Stack](#architettura-e-stack)
- [Build Pipeline](#build-pipeline)
- [Keystore e Firma Play Store](#keystore-e-firma-play-store)
- [Google Login Fix](#google-login-fix)
- [Rebranding VELA](#rebranding-vela)
- [Play Store Production Request](#play-store-production-request)
- [Abbonamenti (Subscriptions)](#abbonamenti-subscriptions)
- [RevenueCat Setup](#revenuecat-setup)
- [Pubblicità AdMob](#pubblicità-admob)

---

## Architettura e Stack

| Componente | Tecnologia |
|------------|------------|
| Mobile app | React Native + Expo SDK 52, TypeScript |
| Router | expo-router (file-based) |
| Navigation | Tab Navigator (invoices, quotes, clients, settings) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Auth | Google Sign-In (OAuth nativo, **solo Google**) |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Payments | RevenueCat (Google Play Billing) |
| Ads | Google AdMob (banner adaptivo + rewarded) |
| PDF | expo-print + logo aziendale da Supabase Storage |
| OCR | Scanner ricevute (camera + estrazione dati) |
| i18n | 7 lingue: IT, EN, DE, ES, FR, PT, ZH |
| Build CI | GitHub Actions |
| Target | Google Play Store |

---

## Build Pipeline

### Workflow principale
- File: `.github/workflows/build-aab.yml`
- Trigger: `workflow_dispatch`
- Tipo: **AAB Release** (Play Store) + **APK Debug** (test interno)

### Passaggi build AAB
1. `actions/checkout@v4`
2. `actions/setup-node@v4`
3. Setup JDK 17
4. Setup Android SDK
5. `npm ci` (install dipendenze)
6. `npx expo prebuild --platform android --no-install --clean`
7. Patch repositories (blocca timeout Sonatype snapshots)
8. Inject Gradle init script (block Sonatype)
9. Decode release keystore from secret → `android/app/release.keystore`
10. Patch `build.gradle` per firma release
11. `./gradlew bundleRelease` (AAB)
12. Upload artifact `InvoiceStudio-v35-AAB`

### Workflow APK Debug
- File: `.github/workflows/build-apk.yml`
- Trigger: `workflow_dispatch`
- Comando: `./gradlew assembleRelease` (standalone)

### Run verdi recenti
| Run | Workflow | Data |
|-----|----------|------|
| 28707139844 | AAB Release v35 | 5 Lug 2026 |
| 28707141346 | APK Debug v35 | 5 Lug 2026 |
| 28705081080 | AAB Release v35 | 4 Lug 2026 |
| 28584181988 | AAB Release v35 (keystore fissa) | 3 Lug 2026 |

### Artifact path locali
- AAB: `aab_download/app-release.aab`
- APK: `apk_download/app-debug.apk`

---

## Keystore e Firma Play Store

### SHA1 certificato firma
```
90:F1:18:35:82:7F:1C:5E:C5:5C:07:B8:D3:1B:27:D1:30:7C:75:24
```

### Dettagli keystore
- **Alias:** `invoicestudio`
- **Store password:** `android`
- **Key password:** `android`
- **Tipo:** PKCS12
- **DN:** CN=VELA, OU=Mobile, O=VELA Apps, L=Rome, ST=Lazio, C=IT

### Storia del recupero
La keystore originale era stata codificata in base64 in un vecchio workflow `build-twa.yml` (commit `ad72996`).
Era stata rimossa dal repo (gitignored in `frontend/twa/`). Recuperata da git history con:
```
git show ad72996:.github/workflows/build-twa.yml
```
Decodificata e salvata come secret GitHub.

### Secret GitHub attivi
- `ANDROID_KEYSTORE_BASE64` — keystore codificata in base64
- `ANDROID_KEYSTORE_PASSWORD` — `android`
- `ANDROID_KEY_ALIAS` — `invoicestudio`
- `ANDROID_KEY_PASSWORD` — `android`

### Bug risolti sul build

| Bug | Fix |
|-----|-----|
| Keystore path duplicato (`android/app/android/app/release.keystore`) | Diverso `ANDROID_KEYSTORE_PATH: release.keystore` |
| Key password non corrispondeva a store password | Allineate a `VelaStorePass2026!` e poi a `android` |
| Keystore generata fresh ogni build (SHA differente) | Usata keystore fissa da secret GitHub |
| `expo-localization` in `plugins` array bloccava prebuild | Rimosso (si auto-configura da `app.plugin.js`) |
| Sonatype snapshots timeout (504) | `patch_repos.py` blocca repo snapshot |
| Path script sbagliato in CI | Passato a `pwd` path corretto |
| `asset:assert` plugin mancante | Rimosso da `app.json` plugins |

---

## Google Login Fix

### Problema
L'utente cliccava "Accedi con Google" → si apriva il browser → l'utente faceva login → **non tornava mai all'app** → loop infinito "Caricamento in corso…" su `login.tsx`.

### Causa
Il codice originale usava:
```
Linking.openURL(data.url) + Linking.addEventListener("url", handler)
```
Su Android, il browser di default (Chrome/Samsung Internet/Xiaomi MIUI) **non propaga il 302 redirect** verso lo scheme custom `vela://auth/callback`. L'app restava in attesa del listener che non scattava mai.

### Fix applicato

**File:** `mobile/hooks/useAuth.tsx`

| Prima | Dopo |
|-------|------|
| `Linking.openURL(data.url)` + listener | `WebBrowser.openAuthSessionAsync(data.url, redirectUrl)` |
| Timeout 5 minuti | Timeout 60 secondi |
| Exit manuale dal browser non gestita | `result.type === "cancel"` gestito → loading si ferma |

`WebBrowser.openAuthSessionAsync`:
- Apre un Chrome Custom Tab (in-app)
- Al redirect `vela://auth/callback?code=...` **chiude automaticamente il tab**
- Restituisce l'URL di callback nel `result.url`
- Compatibile con **tutti** i produttori Android

### Flusso completo dopo fix
1. Utente clicca "Accedi con Google"
2. Si apre il custom tab in-app (non esce dall'app)
3. Utente fa login su Google
4. Google reindirizza a Supabase → Supabase reindirizza a `vela://auth/callback?code=...`
5. `openAuthSessionAsync` intercetta il redirect e chiude il tab
6. `exchangeCodeForSession(code)` scambia il code per sessione
7. `onAuthStateChange` rileva la sessione → reindirizza a `/(app)`
8. Se timeout 60s → messaggio "Timeout: il login non è stato completato"

---

## Rebranding VELA

### Rinominazioni applicate
- `app.json`: `name` → `"VELA — Invoice & Quotes"`
- Dovunque c'erano residui di `InvoiceStudio` nei file source → sostituito da `VELA`
- PDF: branding `"InvoiceStudio"` → `"VELA"`
- Tab bar: titoli aggiornati
- Script `clean_branding.js` eseguito su `app/`, `components/`, `lib/`, `package.json`, `app.json`, `scripts/`

### Icona Quotes
- **Vecchia icona:** `file-tray-full` / `file-tray-full-outline`
- **Nuova icona:** `document-text` / `document-text-outline`
- **Motivo:** `file-tray-full` **non esiste** in `@expo/vector-icons` Ionicons; causava icona SVG invisibile

### Policy icone
- **VIETATO** usare emoji come icone UI in produzione
- **OBBLIGATORIO** usare Ionicons da `@expo/vector-icons`
- Formato: `{name}` / `{name}-outline` per coerenza tab

---

## Play Store Production Request

### Testers
- **Totale:** 12 tester
- **Canali:** rete personale (6), community Discord/Slack (4), beta tester precedenti (2)
- **Durata:** 2 settimane, minimo 8-12 sessioni da 15-30 minuti
- **Device:** Android fisici, WiFi + 4G
- **Google account reali**

### Feedback
- **Positivo (7):** interfaccia pulita, OCR funziona, multilingua utile, performante su telefoni vecchi
- **Bug segnalati e risolti (5):**
  1. Icona preventivi non visibile → Ionicons
  2. Errore AdMob visibile all'utente → catch silenzioso
  3. Branding "InvoiceStudio" residuo in PDF → "VELA"
  4. Cambio lingua non istantaneo → React Context + AsyncStorage
  5. Eliminazione account non funzionava offline → Supabase RPC

### Richiesta produzione
- **Stato:** INVIATA (3 Lug 2026, 15:27)
- **Attesa:** 2-7 giorni (massimo 7)
- Prima pubblicazione → dopo approvazione si può fare update senza test chiuso
- Ogni **nuova app** (stesso account) deve rifare test chiuso 14gg

---

## Abbonamenti (Subscriptions)

### Piani

| Piano | ID Prodotto | ID Piano Base | Prezzo | Periodo |
|-------|-------------|---------------|--------|---------|
| Mensile | `vela-premium-monthly` | `vela-premium-monthly-base` | €4.99 | 1 mese |
| Annuale | `vela-premium-yearly` | `vela-premium-yearly-base` | €39.99 | 1 anno |

### Naming convention
```
vela-premium-{period}[_base?]
```
- Periodi: `monthly`, `yearly`
- Suffisso `-base` per i piani base
- Caratteri: solo `a-z`, `0-9`, `-` (trattino)
- Max: 63 caratteri per ID piano base, 40 per ID abbonamento

### Nome visuale
- Mensile: `VELA Premium — Mensile`
- Annuale: `VELA Premium — Annuale`

### Tag
- Tag comune: `vela-premium`

### Feature (per RevenueCat consent screen / short description)
1. "Fatture e preventivi senza limiti" (33 char)
2. "Zero pubblicità, solo lavoro" (29 char)
3. "Supporto prioritario per chi lavora" (35 char)

### Short description prodotto (40 char max)
```
Illimitati, no ads, supporto prioritario
```

### Descrizione estesa (200 char max)
```
Abbonamento annuale a VELA Premium: fatture, preventivi e clienti senza limiti. Zero pubblicità, supporto prioritario. Risparmia il 30% vs piano mensile.
```

---

## RevenueCat Setup

### Prodotti creati
| Prodotto | RevenueCat ID | Entitlement |
|----------|---------------|-------------|
| VELA Premium — Mensile | `vela-premium-monthly` | `premium` |
| VELA Premium — Annuale | `vela-premium-yearly` | `premium` |

### Google Service Account JSON
- **Percorso locale:** `/home/locoomo/Scaricati/invoice-studio-497410-167812ac4487.json`
- **Dove caricarlo:** RevenueCat Dashboard → Project Settings (⚙️) → App → Google Play Store Configuration → Upload JSON
- **Note:** caricamento una tantum per app, non per prodotto
- **Stato:** DA CARICARE (mostra "Connection issue" finché non caricato)

### Google Play Console — Prodotti in-app
Per ogni abbonamento:
1. Monetizzazione → Prodotti → **Abbonamenti** (NON Prodotti a pagamento singolo)
2. + Crea abbonamento: ID `vela-premium-{period}`, Nome "VELA Premium — {Nome}"
3. + Aggiungi piano base: ID `vela-premium-{period}-base`, Tipo "Rinnovo automatico"
4. Prezzo: Italia €{prezzo}, altri paesi auto-calcolati
5. Billing period: 1 mese (mensile) / 1 anno (annuale)
6. Grace period: 7 giorni (default)
7. Free trial: NESSUNO

### RevenueCat — Creazione prodotto
1. Products → + New Product
2. Display name: "VELA Premium — {Nome}"
3. Product type: Subscription
4. Subscription ID: `vela-premium-{period}`
5. Base plan ID: `vela-premium-{period}-base`
6. Backwards compatible: NON spuntato
7. RevenueCat product identifier: `vela-premium-{period}`
8. Entitlement: `premium`

---

## Pubblicità AdMob

### Account Google
- Publisher ID: `ca-app-pub-4053625490298263`
- App ID: `~3067488369`

### Ad Unit ID da creare su AdMob Console

| Tipo | Dove usarlo | File da aggiornare | Note |
|------|-------------|-------------------|------|
| **Banner adaptivo** | Home screen / banner inferiore | `mobile/components/BannerAdWrapper.tsx` (riga 72) | ID placeholder da sostituire |
| **Rewarded** | Scanner ricevute (quota) | `mobile/lib/useRewardedInvoice.ts` (riga 27) | Forse già ID `3442892886` |
| **Rewarded** | Business Boost / sblocco funzioni | `mobile/lib/business-boost.ts` (riga 31) | Stesso ID `3442892886` |

### GDPR Consent
- **UMP SDK** già integrato
- Parte automaticamente al primo launch su EEA
- Niente Ads SDK per bambini (app 18+)

---

## Scripts

| Script | Percorso | Cosa fa |
|--------|----------|---------|
| `build_release.sh` | `mobile/build_release.sh` | Build locale AAB/APK |
| `clean_branding.js` | `mobile/scripts/clean_branding.js` | Sostituisce "InvoiceStudio" con "VELA" in tutti i file |
| `patch_build_gradle.py` | `mobile/scripts/patch_build_gradle.py` | Aggiunge configurazione firma release in `build.gradle` |
| `patch_repos.py` | `mobile/scripts/patch_repos.py` | Blocca repository Sonatype snapshot in `build.gradle` |
| `verify_android_keystore.sh` | `mobile/scripts/verify_android_keystore.sh` | Verifica keystore locale |

---

## Comandi utili

```bash
# Trigger build AAB
gh workflow run build-aab.yml

# Trigger build APK
gh workflow run 295899858

# Scaricare ultimo artifact
gh run download <RUN_ID> --name <ARTIFACT_NAME> --dir aab_download
gh run download <RUN_ID> --name <ARTIFACT_NAME> --dir apk_download

# Lista run GitHub
gh run list --workflow=build-aab.yml --limit 5

# Costruire il file keystore da base64
base64 -d vela_keystore.b64 > release.keystore
```

---

## LLM Prompt (da usare in Obsidian con plugin Copilot / smart connections)

```
Sei un assistente senior per VELA (Invoice Studio), un'app React Native (Expo SDK 52) per fatture, preventivi e clienti su Android.

DATI DEL PROGETTO:

STACK:
- React Native + Expo SDK 52, TypeScript, expo-router
- Supabase (PostgreSQL + Auth + Storage + RLS)
- RevenueCat (Google Play Billing)
- Google AdMob
- expo-print, expo-sharing

BUILD:
- CI: GitHub Actions → build-aab.yml + build-apk.yml
- AAB: aab_download/app-release.aab (45 MB)
- APK: apk_download/app-debug.apk (160 MB)
- Keystore SHA1: 90:F1:18:35:82:7F:1C:5E:C5:5C:07:B8:D3:1B:27:D1:30:7C:75:24

SUBSCRIPTIONS:
- Mensile (vela-premium-monthly): €4.99/mese
- Annuale (vela-premium-yearly): €39.99/anno
- Feature: illimitati, no ads, supporto prioritario
- RevenueCat: entrambi su entitlements → premium

AUTH:
- Solo Google OAuth nativo
- WebBrowser.openAuthSessionAsync per callback

PUBBLICAZIONE:
- Richiesta produzione inviata 3 Lug 2026
- SHA1 certificato: 90:F1:18:35:82:7F:1C:5E:C5:5C:07:B8:D3:1B:27:D1:30:7C:75:24

RISPOSTE:
- Rispondi in italiano naturale, come se parlassi ad un collega
- Non superare mai 300 caratteri salvo richiesta esplicita
- Dai risposte concrete con percorsi file, comandi e passaggi
- Se proponi una modifica, prima: spiega la modifica, poi chiedi "CONFERMI?" prima di procedere
```

---

## Note finali

- La keystore originale è stata recuperata dal commit `ad72996` (era base64-encoded in build-twa.yml)
- Il SHA1 `90:F1:18:35:82:7F:1C:5E:C5:5C:07:B8:D3:1B:27:D1:30:7C:75:24` viene da una debug.keystore di Trusted Web Activity (TWA) usata per la firma di release
- RevenueCat Google Service Account JSON è pronto al path `/home/locoomo/Scaricati/invoice-studio-497410-167812ac4487.json` — manca solo il caricamento su RevenueCat
- Dopo l'upload del JSON, RevenueCat mostrerà connessione OK e gli acquisti funzioneranno
- L'app è già compilata e firmata con la keystore corretta — pronta per essere caricata su Play Store non appena Google approva la richiesta produzione
