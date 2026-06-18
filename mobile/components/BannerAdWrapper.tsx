/**
 * BannerAdWrapper.tsx — Wrapper sicuro per banner AdMob V34
 *
 * Renderizza un AdMob adaptive banner solo sulle schermate consentite
 * e solo per utenti non-premium. Si auto-nasconde in caso di errore
 * (collasso a zero height, nessun layout shift).
 *
 * Logica di rendering:
 *  1. isPremium === true → return null (Req 3.2, 4.5)
 *  2. screen in BANNER_BLOCKED_SCREENS → return null (Req 4.2, 4.3)
 *  3. screen non in ALLOWED_SCREENS → return null (Req 4.7)
 *  4. Altrimenti → renderizza <BannerAd> (Req 4.1, 4.6)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 3.2, 10.8, 8.1
 */

import React, { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { usePlan } from '@/context/PlanContext';
import { trackEvent } from '@/lib/analytics-events';

// ─── Tipi pubblici ────────────────────────────────────────────────────────────

export interface BannerAdWrapperProps {
  /**
   * La schermata corrente. Deve essere una delle 4 schermate consentite.
   * Il tipo è deliberatamente stretto: schermate non consentite non
   * possono essere passate (Req 4.1).
   */
  screen: 'dashboard' | 'customers' | 'settings' | 'reports';
  style?: StyleProp<ViewStyle>;
}

// ─── Costanti compile-time ────────────────────────────────────────────────────

/**
 * Schermate dove il banner è VIETATO.
 * Array readonly compile-time — non configurabile a runtime (Req 4.3, 10.8).
 */
const BANNER_BLOCKED_SCREENS = [
  'invoice_editor',
  'quote_editor',
  'pdf_preview',
  'payment_flow',
  'contract_editor',
  'pro_upgrade',
] as const;

/**
 * Schermate dove il banner è CONSENTITO (corrisponde al tipo `screen`).
 * Compile-time constant per il check di Req 4.7.
 */
const ALLOWED_SCREENS = [
  'dashboard',
  'customers',
  'settings',
  'reports',
] as const satisfies readonly BannerAdWrapperProps['screen'][];

/**
 * Ad Unit ID per il banner adattivo.
 * Costante compile-time — non sovrascrivibile a runtime (Req 10.8).
 * Usa TestIds in sviluppo, ID produzione in release.
 */
const BANNER_AD_UNIT_ID: string = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-4053625490298263/BANNER_UNIT_ID';

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * BannerAdWrapper
 *
 * Renderizza un banner AdMob adaptive per utenti free sulle schermate
 * consentite. Si comporta in modo silenzioso in tutti i casi di errore
 * o di esclusione (return null / collapse a zero height).
 */
export function BannerAdWrapper({ screen, style }: BannerAdWrapperProps) {
  const { isPremium } = usePlan();

  // Stato: true se l'ad ha fallito il caricamento → collassa l'altezza a 0
  const [adFailed, setAdFailed] = useState(false);

  // ── Guard 1: utenti premium non vedono mai banner (Req 3.2, 4.5) ──────────
  if (isPremium) {
    return null;
  }

  // ── Guard 2: schermate bloccate (Req 4.2, 4.3) ────────────────────────────
  // Usiamo una type assertion per confrontare il prop con la lista bloccata.
  const screenAsString = screen as string;
  if ((BANNER_BLOCKED_SCREENS as readonly string[]).includes(screenAsString)) {
    return null;
  }

  // ── Guard 3: schermate non nella lista consentita (Req 4.7) ───────────────
  if (!(ALLOWED_SCREENS as readonly string[]).includes(screenAsString)) {
    return null;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Traccia l'impression quando il banner viene caricato con successo.
   * Fire-and-forget tramite trackEvent (Req 8.1).
   */
  const handleAdLoaded = () => {
    trackEvent({ event: 'banner_impression', properties: { screen } });
  };

  /**
   * Collassa il container a zero height in caso di errore di caricamento.
   * Nessun errore visibile per l'utente (Req 4.4).
   */
  const handleAdFailedToLoad = () => {
    setAdFailed(true);
  };

  /**
   * Traccia il click sul banner (Req 8.1).
   */
  const handleAdOpened = () => {
    trackEvent({ event: 'banner_click', properties: { screen } });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        adFailed && styles.collapsed,
        style,
      ]}
      // Accessibilità: non annunciare il container del banner agli screen reader
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdFailedToLoad}
        onAdOpened={handleAdOpened}
      />
    </View>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  /**
   * Collasso a zero height su errore — nessun layout shift (Req 4.4).
   * height: 0 rimuove lo spazio senza rimuovere il nodo dal DOM nativo.
   */
  collapsed: {
    height: 0,
  },
});
