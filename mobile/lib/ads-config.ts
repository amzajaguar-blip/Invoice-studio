/**
 * ads-config.ts — Unica fonte di verità per gli ad unit AdMob.
 *
 * Perché esiste
 * ─────────────
 * Gli ID erano scritti in tre file diversi (`ads.ts`, `reward-ad.ts`,
 * `BannerAdWrapper.tsx`), ognuno con il proprio `__DEV__ ? TestIds : '<id
 * reale>'`. Due conseguenze: in una build di release non c'era modo di provare
 * gli annunci senza modificare il codice a mano, e ogni swap manuale poteva
 * dimenticarsi uno dei tre punti — spedendo in produzione un ID demo, che non
 * genera revenue e può violare le policy.
 *
 * Qui c'è un interruttore solo, e gli ID reali stanno in un blocco separato che
 * nessuna modalità di test sovrascrive.
 *
 * Modalità (`EXPO_PUBLIC_ADS_MODE`)
 * ─────────────────────────────────
 * `test-demo`    ID demo ufficiali Google. Sempre attivi, non legati al nostro
 *                account, quindi funzionano anche mentre AdMob è "In
 *                preparazione". Verificano che l'SDK sia integrato e che l'UI
 *                mostri l'annuncio. NON passano dal nostro SSV: la callback di
 *                reward lato server non scatta.
 *
 * `test-device`  ID REALI, con il dispositivo registrato come test device.
 *                Le creatività sono di test ma la chiamata passa dalla
 *                configurazione vera dell'ad unit: è l'unico modo di sapere se
 *                il reward arriva davvero al backend via SSV.
 *
 * `production`   ID reali, nessun test device. Da usare per ogni build che va
 *                sullo store.
 *
 * Default: `test-demo` durante lo sviluppo, `production` in release. Così una
 * build di produzione senza variabile d'ambiente non può finire con gli ID
 * demo per dimenticanza.
 */

import { TestIds } from 'react-native-google-mobile-ads';

export type AdsMode = 'test-demo' | 'test-device' | 'production';

/**
 * ID di PRODUZIONE — l'identità monetizzabile dell'app.
 *
 * Non vanno modificati per testare: esistono `test-demo` e `test-device`
 * apposta. `test-device` li riusa così come sono.
 */
export const PRODUCTION_AD_UNITS = {
  appId: 'ca-app-pub-8156953772676654~4738629818',
  banner: 'ca-app-pub-8156953772676654/4020450686',
  interstitial: 'ca-app-pub-8156953772676654/6372493305',
  rewarded: 'ca-app-pub-8156953772676654/2433248294',
} as const;

/**
 * ID demo pubblici di Google. Sono costanti documentate, non segreti, e
 * restano attivi indipendentemente dallo stato del nostro account AdMob.
 */
const DEMO_AD_UNITS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

function resolveMode(): AdsMode {
  const raw = String(process.env.EXPO_PUBLIC_ADS_MODE ?? '').trim();
  if (raw === 'test-demo' || raw === 'test-device' || raw === 'production') {
    return raw;
  }
  return __DEV__ ? 'test-demo' : 'production';
}

/** Modalità attiva in questa build. Risolta una volta sola all'avvio. */
export const ADS_MODE: AdsMode = resolveMode();

/** True quando gli ID usati sono quelli reali (test-device o production). */
export const USING_REAL_AD_UNITS = ADS_MODE !== 'test-demo';

/**
 * Ad unit effettivi per questa build.
 *
 * `test-device` usa gli ID reali di proposito: è ciò che rende verificabile il
 * percorso SSV. La differenza con `production` è il dispositivo registrato come
 * tester, non l'ID.
 */
export const AD_UNITS =
  ADS_MODE === 'test-demo' ? DEMO_AD_UNITS : PRODUCTION_AD_UNITS;

/**
 * Identificatori dei dispositivi di test, da `EXPO_PUBLIC_ADS_TEST_DEVICE_ID`
 * (più d'uno separati da virgola). Serve solo in `test-device`.
 *
 * L'ID del dispositivo lo stampa l'SDK al primo caricamento di un annuncio:
 *   adb logcat | grep "Use RequestConfiguration.Builder.setTestDeviceIds"
 */
export const TEST_DEVICE_IDS: string[] =
  ADS_MODE === 'test-device'
    ? String(process.env.EXPO_PUBLIC_ADS_TEST_DEVICE_ID ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

/**
 * `TestIds` della libreria: equivalenti agli ID demo di Google, usati solo come
 * rete di sicurezza se qualcuno importasse questo modulo fuori contesto.
 */
export const LIBRARY_TEST_IDS = TestIds;

/** Riga diagnostica da loggare all'avvio: dice quale modalità è attiva. */
export function describeAdsMode(): string {
  return (
    `[ADS] mode=${ADS_MODE} realUnits=${USING_REAL_AD_UNITS} ` +
    `banner=${AD_UNITS.banner} interstitial=${AD_UNITS.interstitial} ` +
    `rewarded=${AD_UNITS.rewarded} testDevices=${TEST_DEVICE_IDS.length}`
  );
}
