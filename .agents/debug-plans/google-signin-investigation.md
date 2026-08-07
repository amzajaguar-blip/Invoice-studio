# Debug Plan — Google Sign-In non funziona su APK debug (v66)

**Data:** 2026-07-31
**Apk:** `/home/locoomo/Scrivania/building factory/saas_app/Invoice-studio/artifacts/VELA-v66-APK/app-debug.apk`
**Package:** `com.Invoice_Studio.myapp`
**SHA256:** `4a2da6f074b037a88ed730d65b6b65c4111def878977cb7918b8a5fe73044c53`
**Test runner:** Appetize `lax4b-android-24.appetize.io` (x86_64 emulator via `adb` tunnel)

## Sintomo confermato

L'app non crasha più al boot (`SoLoaderDSONotFoundError` e `NoClassDefFoundError: VRUtilities` risolti). Tuttavia, cliccando "Accedi con Google" nella `LoginScreen`:

1. App resta in stato `loading=true`
2. `WebBrowser.openAuthSessionAsync` non ritorna mai (o ritorna `type: 'cancel'`/'dismiss')
3. `PlanContext` mostra: `There is no singleton instance. Make sure you configure Purchases before trying to get the default instance` (conseguenza)
4. RevenueCat: `BILLING_UNAVAILABLE` (atteso su emulator senza Play Store)

## Stack tecnologico del flusso

```
LoginScreen (app/(auth)/login.tsx)
    ↓ handleGoogleLogin()
useAuth().signInWithGoogle()        (hooks/useAuth.tsx:84)
    ↓ supabase.auth.signInWithOAuth({provider:'google', redirectTo, skipBrowserRedirect:true})
    ↓ WebBrowser.openAuthSessionAsync(data.url, redirectUrl)   (hook riga 172)
    ↓ handleUrl(url)                                              (hook riga 102)
        → exchangeCodeForSession(code)   OR   setSession(access_token, refresh_token)
```

**Redirect URL costruito:** `Linking.createURL("/auth/callback")` → `vela://auth/callback`
**App scheme:** `vela` (app.json riga `scheme: "vela"`)

## File rilevanti

| File | Cosa contiene |
|---|---|
| `mobile/app/(auth)/login.tsx` | UI bottone Google (linee 50-100) |
| `mobile/hooks/useAuth.tsx` | `signInWithGoogle` intero flow (linee 84-180) |
| `mobile/app.json` | `scheme: "vela"` + `intentFilters` |
| `mobile/lib/auth-deep-link.ts` | deep-link callback handler |
| `mobile/android/app/build.gradle` | applicationId + signingConfigs |
| Supabase dashboard | Site URL + Redirect URLs whitelist |

## ⚠️ Bug sospetto #1: `intentFilters` config

Verifica in `mobile/app.json` se `intentFilters` ha `autoVerify=true` e `host` corretto. Se manca `host` Supabase Auth restituisce errore perché Google OAuth richiede HTTPS redirect, e `vela://` non viene accettato se la Site URL di Supabase non lo whitelista.

**Cosa controllare:**
```bash
grep -B2 -A20 "intentFilters" mobile/app.json
```

## ⚠️ Bug sospetto #2: redirect URL mismatch

Supabase dashboard `Authentication → URL Configuration → Redirect URLs` deve includere ESATTAMENTE `vela://auth/callback`. Se è solo `https://...` o `io.invertase...`, il flow muore.

**Come verificare:** 
- Vai su https://supabase.com/dashboard/project/[project-id]/auth/url-configuration
- Controlla che `vela://auth/callback` sia nella lista

## ⚠️ Bug sospetto #3: Site URL mismatch

`Authentication → URL Configuration → Site URL` deve essere `vela://auth/callback` OPPURE un URL HTTPS pubblico (la `Site URL` viene usata come default redirect per OAuth).

Se `Site URL = https://invoicestudio.app` ma il client passa `redirectTo: vela://auth/callback`, Supabase potrebbe rifiutare o accettare parzialmente.

## ⚠️ Bug sospetto #4: `skipBrowserRedirect: true` + WebBrowser

In `useAuth.tsx:91` c'è `skipBrowserRedirect: true` (corretto — il flow fa manualmente openAuthSessionAsync).

**Verifica logica:** `data.url` viene ritornato da `signInWithOAuth` quando `skipBrowserRedirect=true` è il link a Google. `WebBrowser.openAuthSessionAsync(data.url, redirectUrl)` apre un Custom Tab e aspetta il redirect a `redirectUrl`.

**Possibili failure modes:**
- `result.type === 'cancel'` → utente ha chiuso manualmente
- `result.type === 'dismiss'` → browser chiuso senza redirect
- `result.type === 'locked'` (iOS only) → ignorato su Android
- `WebBrowser.openAuthSessionAsync` blocca per 60s e ritorna `timeout`

## ⚠️ Bug sospetto #5: Google OAuth client config

Google Cloud Console → OAuth 2.0 Client IDs (Android):
- Package name: `com.Invoice_Studio.myapp` (deve combaciare ESATTAMENTE)
- SHA-1 fingerprint: deve essere quella del **debug keystore** (per il debug APK)

L'APK debug è firmato con il debug keystore di default (`~/.android/debug.keystore` su Android Studio). Lo SHA-1 di quel keystore deve essere registrato in Google Cloud Console per il client OAuth Android, altrimenti Google blocca il flow con `Error 400: invalid_request` o simile.

**Come ottenere SHA-1 del debug keystore:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
```

**Oppure scaricare l'APK firmato debug e ispezionare:**
```bash
unzip -p app-debug.apk META-INF/CERT.RSA | keytool -printcert 2>/dev/null | grep "SHA1"
```

## ⚠️ Bug sospetto #6: `expo-auth-session` vs `expo-web-browser`

Il progetto usa `expo-web-browser` direttamente, NON `@react-native-google-signin/google-signin` né `expo-auth-session`. Questo significa che il flow è **PKCE OAuth2 generico** con Google come provider — Supabase gestisce il code exchange.

Verifica che `@supabase/supabase-js` sia recente abbastanza da supportare PKCE flow con Google (>=2.0.0 dovrebbe essere OK).

## Procedura di debug consigliata

### Step 1: Cattura il comportamento REALE del flow

Su Appetize (o device fisico) con `adb logcat`:

```bash
adb logcat -c
# Tap sul bottone Google
adb logcat | grep -E "ReactNativeJS|Browser|ChromeCustomTab|WebView|Skipping"
```

Cercare questi pattern nei log:
- `WebBrowser.openAuthSessionAsync` → inizio apertura
- `chrome_custom_tab` → apertura Custom Tab
- `https://accounts.google.com/o/oauth2/v2/auth?...` → URL generato da Supabase
- `vela://auth/callback?...` → callback finale
- `BillingClient` errors → conseguenza (ignorare per ora)

### Step 2: Identifica a che punto si ferma il flow

| Punto | Sintomo | Fix probabile |
|---|---|---|
| `signInWithOAuth` ritorna `error` | errore nel log `ReactNativeJS` | check Supabase API key + Site URL |
| `data.url` undefined | no URL di login | check `skipBrowserRedirect` flag |
| `openAuthSessionAsync` ritorna `cancel` | utente ha chiuso il browser | UI feedback |
| `openAuthSessionAsync` non ritorna | Chrome Custom Tab non riesce ad aprire `vela://` | aggiungere intent filter per `vela://` |
| `handleUrl` riceve URL ma `code` è null | PKCE flow fallito | check redirect URL whitelist in Supabase |
| `exchangeCodeForSession` ritorna error | PKCE code già usato o scaduto | re-login |

### Step 3: Fix specifici per ogni failure mode

**Per "openAuthSessionAsync non ritorna":**
```typescript
// Verifica che intentFilters in app.json sia corretto:
"intentFilters": [
  {
    "action": "VIEW",
    "category": ["BROWSABLE", "DEFAULT"],
    "data": { "scheme": "vela" }
  }
]
```
Questo deve essere in `expo.android` in app.json.

**Per "data.url undefined":**
Rimuovi `skipBrowserRedirect: true` temporaneamente per vedere se Supabase ritorna direttamente l'URL.

**Per "code sempre null":**
Controlla che Supabase Site URL = `vela://auth/callback` (o che sia nella lista whitelist).

**Per "Google OAuth 400 invalid_request":**
Aggiungi SHA-1 del debug keystore in Google Cloud Console → OAuth client Android.

## File da ispezionare/correggere

1. `mobile/app.json` — verificare `scheme` e `intentFilters`
2. `mobile/hooks/useAuth.tsx` — il flow (linee 84-180)
3. `mobile/android/app/build.gradle` — `applicationId` deve essere `com.Invoice_Studio.myapp`
4. Supabase Dashboard → URL Configuration
5. Google Cloud Console → OAuth client IDs (Android)

## Comandi diagnostici rapidi

```bash
# 1. Verifica intent filters nel codice
grep -A20 "intentFilters" mobile/app.json

# 2. Verifica SHA-1 del debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android 2>&1 | grep SHA1

# 3. SHA-1 dell'APK firmato
unzip -p "/home/locoomo/Scrivania/building factory/saas_app/Invoice-studio/artifacts/VELA-v66-APK/app-debug.apk" META-INF/CERT.RSA | keytool -printcert 2>/dev/null | grep -E "SHA1|Owner"

# 4. applicationId attuale
grep "applicationId\|namespace" mobile/android/app/build.gradle

# 5. Verifica Supabase config
grep -E "EXPO_PUBLIC_SUPABASE|supabaseUrl" mobile/app.json mobile/.env 2>/dev/null
```

## Hypothesis shortlist (in ordine di probabilità)

1. **Alta probabilità:** `Site URL` o `Redirect URLs` whitelist in Supabase non include `vela://auth/callback` → Supabase blocca il flow con `redirect_uri_mismatch`
2. **Media probabilità:** Google Cloud Console OAuth Android client ha SHA-1 sbagliato (manca il debug keystore SHA-1) → Google blocca con `invalid_request`
3. **Media probabilità:** `intentFilters` mancante o mal configurato in `app.json` → Android non sa gestire il redirect `vela://`
4. **Bassa probabilità:** Bug nel `handleUrl` (riga 102 useAuth.tsx) — magari `URL` parsing fallisce silenziosamente

---

## ✅ RISOLUZIONE (2026-07-31)

**Causa radice confermata:** Combinazione di #1 e #2 — il flow richiedeva che SIA la whitelist Supabase SIA il Google Cloud Console OAuth client fossero configurati correttamente.

### Configurazione corretta verificata

**App side (già OK prima del fix):**
- `scheme: "vela"` in `mobile/app.json`
- `intentFilters` con `action: VIEW`, `scheme: vela`, `category: BROWSABLE + DEFAULT`
- `applicationId: com.Invoice_Studio.myapp`
- `signInWithOAuth` con `skipBrowserRedirect: true` + `redirectTo: Linking.createURL("/auth/callback")`
- `WebBrowser.openAuthSessionAsync(data.url, redirectUrl)` con timeout 60s

**Server side (era mancante — fix applicato):**
- **Supabase Dashboard → Authentication → URL Configuration:**
  - Site URL: `vela://auth/callback`
  - Redirect URLs whitelist: `vela://auth/callback`
- **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs (Android):**
  - Package name: `com.Invoice_Studio.myapp` (esatto)
  - SHA-1 fingerprint: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (debug keystore)

### Procedura diagnostica che ha funzionato

1. ✅ Verificato `intentFilters` corretto in `app.json` (era già OK)
2. ✅ Verificato `scheme: "vela"` in `app.json` (era già OK)
3. ✅ Estratto SHA-1 del debug keystore con `keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android`
4. ✅ Confermato SHA-1 APK con `apksigner verify --print-certs` → `5e8f16062ea3cd2c4a0d547876baa6f38cabf625`
5. 🔧 Aggiunto `vela://auth/callback` alla whitelist Supabase Redirect URLs
6. 🔧 Aggiunto SHA-1 debug a Google Cloud Console OAuth Android client
7. ✅ Test su Appetize: login Google completato con successo

### Lezione per il futuro

**Per Google Sign-In su React Native + Supabase, servono 3 cose tutte corrette:**

1. **App config (codice):** scheme + intentFilters + applictionId
2. **Supabase whitelist:** `vela://auth/callback` (o scheme equivalente) DEVE essere in Site URL e Redirect URLs
3. **Google Cloud Console:** SHA-1 del keystore che firma l'APK DEVE essere registrato per il package name esatto

Se solo 1 di 3 manca → flow muore silenziosamente senza error message chiaro. Supabase restituisce `redirect_uri_mismatch`, Google restituisce `invalid_request` — entrambi arrivano come "login non completato" senza dettagli.

### Comando diagnostico rapido (reference futura)

```bash
# Da eseguire SEMPRE prima di dichiarare "Google Sign-In non funziona":
keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android 2>&1 | grep SHA1
apksigner verify --print-certs path/to/app-debug.apk 2>&1 | grep "SHA-1"
```

Entrambi devono matchare ESATTAMENTE il valore in Google Cloud Console.

## Quando il fix funziona, cosa deve succedere

1. Click su "Accedi con Google" → Chrome Custom Tab si apre
2. Google login web UI appare
3. Utente seleziona account
4. Redirect a `vela://auth/callback?code=...`
5. App si riprende in foreground, `handleUrl` parsifica il code
6. `exchangeCodeForSession(code)` chiama Supabase
7. Session viene salvata in SecureStore
8. `onAuthStateChange` listener triggera redirect automatico a `/(app)/dashboard`
9. `PlanContext` carica i dati RevenueCat (questo è un problema separato se manca init)

## ⚠️ Sub-bug correlato: RevenueCat non inizializzato

Dopo il fix Google Sign-In, il prossimo problema sarà:
```
[PlanContext] getCustomerInfo error: 
  There is no singleton instance. 
  Make sure you configure Purchases before trying to get the default instance
```

Questo significa che `Purchases.configure({apiKey: REVENUECAT_API_KEY})` NON viene chiamato all'avvio. Verificare:
- `app/_layout.tsx` deve avere `useEffect(() => Purchases.configure(...), [])`
- OPPURE `context/RevenueCatProvider.tsx` se esiste

File da ispezionare: `mobile/app/_layout.tsx` (root layout)
