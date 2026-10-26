/**
 * AdBanner.tsx — Banner AdMob ancorato, mostrato solo agli utenti free.
 *
 * Dove vive
 * ─────────
 * Montato una sola volta nella tab bar (`app/(app)/(tabs)/_layout.tsx`),
 * subito sopra le voci di navigazione: così appare in modo coerente su
 * Dashboard / File / Impostazioni senza duplicare il componente in ogni
 * schermata. react-navigation misura l'altezza reale della tab bar (banner
 * incluso) e la riporta come inset in basso alle schermate, quindi il
 * contenuto scrollabile non finisce mai nascosto dietro l'annuncio.
 *
 * Quando NON si mostra (render null, zero spazio occupato)
 * ────────────────────────────────────────────────────────
 *  - Utente Pro (`isPremium`): niente pubblicità, è ciò che si paga.
 *  - Piano non ancora risolto (`limits.isLoading`): un Pro appena aperto
 *    l'app non deve vedere il banner lampeggiare prima che RevenueCat
 *    risponda — stesso fail-safe di `useDocumentAd`.
 *  - SDK non inizializzato: `initAds()` inizializza l'SDK SOLO dopo che il
 *    consenso UMP è stato raccolto e `canRequestAds` è true. Finché
 *    `isAdsInitialized()` è false non montiamo `BannerAd`, quindi nessuna
 *    richiesta di annuncio parte senza consenso (GDPR/EEA).
 *  - Nessun fill / errore di caricamento: il contenitore collassa a 0 così
 *    non resta una barra vuota sopra la tab bar.
 *
 * Il banner resta montato una volta inizializzato l'SDK, così l'SDK può
 * ricaricare/aggiornare la creatività; è il contenitore a nascondersi quando
 * non c'è un annuncio da mostrare, non il `BannerAd` a smontarsi.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';
import { usePlan } from '@/context/PlanContext';
import { AD_UNITS } from '@/lib/ads-config';
import { isAdsInitialized, onAdsInitialized } from '@/lib/ads';

export function AdBanner(): React.ReactElement | null {
  const { isPremium, limits } = usePlan();
  const [sdkReady, setSdkReady] = useState<boolean>(isAdsInitialized());
  const [loaded, setLoaded] = useState(false);

  // Si aggancia all'inizializzazione dell'SDK (che avviene solo dopo il
  // consenso UMP). Finché non è pronto, il componente resta null.
  useEffect(() => {
    if (sdkReady) return;
    const unsub = onAdsInitialized(() => setSdkReady(true));
    return unsub;
  }, [sdkReady]);

  // Pro, piano ancora in caricamento, o SDK non inizializzato → nessun banner.
  if (isPremium || limits.isLoading || !sdkReady) {
    return null;
  }

  return (
    // Quando l'annuncio non è ancora caricato (o è andato in errore) il
    // contenitore collassa a 0: nessuna barra vuota sopra la tab bar.
    <View style={loaded ? styles.container : styles.collapsed}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        // requestNonPersonalizedAdsOnly resta false: l'SDK applica da solo
        // la scelta NPA letta dal consenso UMP, come per l'interstitial.
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111318',
    borderTopWidth: 1,
    borderTopColor: '#1e2029',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsed: {
    height: 0,
    overflow: 'hidden',
  },
});

export default AdBanner;
