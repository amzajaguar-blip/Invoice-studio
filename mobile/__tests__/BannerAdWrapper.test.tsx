/**
 * BannerAdWrapper.test.tsx — comportamento del banner rispetto ai tre esiti
 * possibili di una richiesta AdMob:
 *
 *   1. successo  (onAdLoaded)          → il banner resta a schermo
 *   2. fallimento(onAdFailedToLoad)    → il banner si nasconde
 *   3. silenzio  (nessuna callback)    → dopo il timeout il banner si nasconde
 *
 * Il caso 3 e' quello che il safety timeout deve coprire; il caso 1 e' quello
 * che il safety timeout non deve rompere.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

// ─── Mock del modulo AdMob ───────────────────────────────────────────────────
// Il vero BannerAd e' una view nativa: qui viene sostituito da una View che
// espone le callback su un registro globale, cosi' il test puo' simulare
// l'arrivo (o la mancanza) della risposta di AdMob.

type AdCallbacks = {
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (err: unknown) => void;
};
const mockAdCallbacks: AdCallbacks = {};

jest.mock('react-native-google-mobile-ads', () => {
  const RN = require('react-native');
  const ReactLib = require('react');
  return {
    __esModule: true,
    BannerAd: (props: AdCallbacks) => {
      mockAdCallbacks.onAdLoaded = props.onAdLoaded;
      mockAdCallbacks.onAdFailedToLoad = props.onAdFailedToLoad;
      return ReactLib.createElement(RN.View, { testID: 'banner-ad' });
    },
    BannerAdSize: { BANNER: 'BANNER' },
    TestIds: { BANNER: 'test-banner' },
  };
});

jest.mock('@/lib/ads', () => ({
  isAdsInitialized: () => true,
  onAdsInitialized: (_l: () => void) => () => {},
}));

jest.mock('@/lib/ads-config', () => ({
  AD_UNITS: { banner: 'ca-app-pub-test/banner' },
}));

import { BannerAdWrapper } from '@/components/BannerAdWrapper';

describe('BannerAdWrapper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete mockAdCallbacks.onAdLoaded;
    delete mockAdCallbacks.onAdFailedToLoad;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resta visibile dopo un caricamento riuscito, anche oltre il timeout', () => {
    const { queryByTestId } = render(<BannerAdWrapper screen="dashboard" />);
    expect(queryByTestId('banner-ad')).not.toBeNull();

    // AdMob risponde: annuncio caricato.
    act(() => {
      mockAdCallbacks.onAdLoaded?.();
    });

    // Passa ampiamente il tempo del safety timeout.
    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    // Un annuncio che si e' caricato non deve sparire allo scadere del timeout.
    expect(queryByTestId('banner-ad')).not.toBeNull();
  });

  it('resta visibile se un refresh fallisce dopo un caricamento riuscito', () => {
    const { queryByTestId } = render(<BannerAdWrapper screen="dashboard" />);

    // Primo fill riuscito: l'annuncio e' a schermo.
    act(() => {
      mockAdCallbacks.onAdLoaded?.();
    });
    expect(queryByTestId('banner-ad')).not.toBeNull();

    // AdMob rinfresca da solo il banner; questo giro non c'e' fill.
    act(() => {
      mockAdCallbacks.onAdFailedToLoad?.(new Error('no-fill-on-refresh'));
    });

    // L'annuncio gia' caricato non deve sparire per un refresh a vuoto.
    expect(queryByTestId('banner-ad')).not.toBeNull();
  });

  it('si nasconde quando AdMob risponde con un errore', () => {
    const { queryByTestId } = render(<BannerAdWrapper screen="dashboard" />);
    expect(queryByTestId('banner-ad')).not.toBeNull();

    act(() => {
      mockAdCallbacks.onAdFailedToLoad?.(new Error('no-fill'));
    });

    expect(queryByTestId('banner-ad')).toBeNull();
  });

  it('si nasconde se AdMob non risponde affatto entro il timeout', () => {
    const { queryByTestId } = render(<BannerAdWrapper screen="dashboard" />);
    expect(queryByTestId('banner-ad')).not.toBeNull();

    // Nessuna callback: e' lo scenario "In preparazione" / SDK zombie.
    act(() => {
      jest.advanceTimersByTime(10_500);
    });

    expect(queryByTestId('banner-ad')).toBeNull();
  });
});
