/**
 * BannerAdWrapper.tsx — Banner AdMob per Milo Office (utenti free).
 *
 * Mostra un banner AdMob standard (320×50) nelle schermate consentite.
 * Se l'ad non si carica (no fill, rete, ecc.) il componente si nasconde
 * silenziosamente senza interrompere il layout.
 * Il banner non viene richiesto prima che il SDK sia inizializzato
 * (consenso UMP risolto via initAds in lib/ads.ts).
 *
 * Ad Unit ID produzione: ca-app-pub-8156953772676654/4020450686
 * In DEV usa TestIds.BANNER per evitare click invalidi.
 */

import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { isAdsInitialized, onAdsInitialized } from '@/lib/ads';
import { AD_UNITS } from '@/lib/ads-config';

// ─── Config ──────────────────────────────────────────────────────────────────

const BANNER_AD_UNIT_ID = AD_UNITS.banner;

/**
 * Oltre questo tempo senza risposta da AdMob la richiesta è considerata persa.
 * Stesso valore del rewarded (`REWARD_AD_LOAD_TIMEOUT_MS` in reward-ad.ts): un
 * banner che non ha risposto entro 10s non risponderà più.
 */
const BANNER_LOAD_TIMEOUT_MS = 10_000;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BannerAdWrapperProps {
  screen: 'dashboard' | 'customers' | 'settings' | 'reports';
  style?: StyleProp<ViewStyle>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BannerAdWrapper({ style }: BannerAdWrapperProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [adsReady, setAdsReady] = useState(isAdsInitialized());

  useEffect(() => onAdsInitialized(() => setAdsReady(true)), []);

  // Safety timeout: se il banner non riceve né onAdLoaded né onAdFailedToLoad
  // (es. AdMob "In preparazione", SDK zombie, rete che risponde con payload
  // vuoto), la richiesta resterebbe appesa per sempre. Allo scadere del
  // timeout si passa a failed e il banner si nasconde.
  //
  // `loaded` deve stare nella condizione e nelle dipendenze: senza, il timer
  // continua a correre anche dopo un caricamento riuscito e dopo 10s fa sparire
  // un annuncio che era a schermo e funzionante.
  useEffect(() => {
    if (!adsReady || failed || loaded) return;
    const t = setTimeout(() => setFailed(true), BANNER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [adsReady, failed, loaded]);

  // Niente richiesta prima che consenso UMP + initialize() siano completati;
  // se l'ad fallisce prima di essersi mai caricato, non rendiamo nulla per non
  // lasciare spazio vuoto.
  //
  // `&& !loaded`: un banner già a schermo non va tolto. AdMob rinfresca il
  // banner da solo a intervalli configurati in console, e un refresh senza fill
  // emette onAdFailedToLoad — senza questa condizione un annuncio funzionante
  // sparirebbe dopo il primo refresh a vuoto, per il resto della sessione.
  if (!adsReady || (failed && !loaded)) return null;

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => {
          // Solo il fallimento della PRIMA richiesta nasconde il banner: dopo
          // un caricamento riuscito gli errori arrivano dai refresh e vanno
          // ignorati (l'annuncio precedente resta valido a schermo).
          if (!loaded) setFailed(true);
        }}
      />
    </View>
  );
}
