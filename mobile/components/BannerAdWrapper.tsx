/**
 * BannerAdWrapper.tsx — Banner AdMob per VELA (utenti free).
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

// ─── Config ──────────────────────────────────────────────────────────────────

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-8156953772676654/4020450686';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BannerAdWrapperProps {
  screen: 'dashboard' | 'customers' | 'settings' | 'reports';
  style?: StyleProp<ViewStyle>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BannerAdWrapper({ style }: BannerAdWrapperProps) {
  const [failed, setFailed] = useState(false);
  const [adsReady, setAdsReady] = useState(isAdsInitialized());

  useEffect(() => onAdsInitialized(() => setAdsReady(true)), []);

  // Niente richiesta prima che consenso UMP + initialize() siano completati;
  // se l'ad fallisce, non rendiamo nulla per non lasciare spazio vuoto.
  if (!adsReady || failed) return null;

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
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
