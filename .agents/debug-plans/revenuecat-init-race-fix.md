# Debug Plan — RevenueCat "no singleton instance" (v66)

**Data:** 2026-07-31
**File:** `mobile/context/PlanContext.tsx` + `mobile/app/_layout.tsx`
**Severity:** P2 (app resta su free, ma `PlanContext` logga errore confuso)

## Sintomo

Dopo il login Google (ora funzionante), il log mostra:

```
[PlanContext] getCustomerInfo error:
  There is no singleton instance.
  Make sure you configure Purchases before trying to get the default instance
```

L'app resta funzionante ma resta su piano `free` perché RevenueCat non riesce a leggere il `CustomerInfo`.

## Root cause

**Race condition** tra `RootLayout.useEffect` e `PlanProvider.useEffect`:

1. `_layout.tsx` riga 183 chiama `Purchases.configure({ apiKey })` dentro `useEffect` (eseguito DOPO il render)
2. `PlanProvider` (figlio) chiama `Purchases.getCustomerInfo()` nel suo `useEffect`
3. React 19 StrictMode può eseguire il `useEffect` del child PRIMA che `Purchases.configure()` propaghi il singleton nativo (particolarmente vero su Android emulator senza Play Store)
4. `getCustomerInfo()` chiama il bridge nativo → bridge ritorna "no singleton instance" perché `configure()` non ha ancora registrato il listener nativo

## Conferma della root cause

Il messaggio "no singleton instance" viene generato dal **codice nativo Android** (`RNPurchases.kt`):
```kotlin
if (!purchasesConfigured) {
    reject("no_singleton_instance", "There is no singleton instance. Make sure you configure Purchases before trying to get the default instance.", null)
}
```

Il check `purchasesConfigured` è un `Boolean` impostato sincronamente da `configure()`, ma la propagazione attraverso il JSI bridge può ritardare di 1-2 frame.

## Fix applicato

**File:** `mobile/context/PlanContext.tsx`

Aggiunto wrapper `waitForPurchasesConfigured()` con retry + backoff esponenziale:
- Controlla `Purchases.isConfigured()` (introdotto in react-native-purchases 5.0+)
- Backoff: 100ms → 200ms → 400ms → ... → max 2000ms
- Max 8 tentativi = ~8s di attesa totale
- Se `configure()` non arriva entro il timeout, logga warning e abbandona silenziosamente
- Tutto il listener `addCustomerInfoUpdateListener` + `getCustomerInfo` viene chiamato SOLO dopo che `isConfigured()` è true

### Codice chiave

```typescript
async function waitForPurchasesConfigured(attempt = 0): Promise<boolean> {
  if (cancelled) return false;
  try {
    if (Purchases.isConfigured && Purchases.isConfigured()) return true;
  } catch { /* SDK vecchio */ }
  if (attempt >= maxAttempts) return false;
  await new Promise((r) => setTimeout(r, retryDelay));
  retryDelay = Math.min(retryDelay * 2, maxDelay);
  return waitForPurchasesConfigured(attempt + 1);
}

waitForPurchasesConfigured().then((ready) => {
  if (!ready) {
    console.warn('[PlanContext] Purchases.configure() never completed within timeout — skipping RevenueCat init');
    return;
  }
  // ... addCustomerInfoUpdateListener + getCustomerInfo
});
```

## Perché NON abbiamo spostato `configure()` in un file separato

Avremmo potuto estrarre `Purchases.configure()` in `mobile/lib/purchases-init.ts` importato come side-effect al top di `_layout.tsx`. Ma:
- Su `react-native-purchases` 10.x, `configure()` deve essere chiamato nel thread React (non modulo scope) per accedere a `Constants.expoConfig?.extra?.revenueCatApiKey`
- Il retry nel consumer (`PlanContext`) è la soluzione più difensiva — funziona anche se in futuro qualcuno sposta `configure()` in un altro punto del codice

## Test di validazione

### Step 1: Build APK debug e installa
```bash
cd mobile
npx expo prebuild --clean
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Step 2: Login con Google

### Step 3: Cattura log
```bash
adb logcat -c
# Login + aspetta che PlanContext si inizializzi
adb logcat | grep -E "PlanContext|RevenueCat|Purchases"
```

### Log atteso (dopo fix)
```
[BOOT] BOOT_002a RevenueCat configured for android
[PlanContext] getCustomerInfo resolved (entro ~200ms-2s dal mount)
```

### Log PRIMA del fix (da confermare che non c'è più)
```
❌ [PlanContext] getCustomerInfo error: There is no singleton instance...
```

## Note per il futuro

- **react-native-purchases 10.6+** ha introdotto `isConfigured()` (vedi `mobile/node_modules/react-native-purchases/dist/purchases.d.ts` riga 92)
- Il pattern "wait for configure then subscribe" dovrebbe essere applicato a QUALSIASI consumer di `Purchases.*` API, non solo `getCustomerInfo()`. Anche `getOfferings()`, `restorePurchases()`, `purchasePackage()` soffrono della stessa race
- Se in futuro aggiungiamo altri `Purchases.*` calls in altri componenti, applicare lo stesso pattern

## File modificati

- `mobile/context/PlanContext.tsx` — aggiunto `waitForPurchasesConfigured()` wrapper
