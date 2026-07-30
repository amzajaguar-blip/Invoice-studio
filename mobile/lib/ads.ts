/**
 * ads.ts — AdMob interstitial helper for VELA freemium model.
 *
 * Shows an interstitial ad after the user saves their Nth invoice of the
 * calendar month (default: every 4th invoice). This is the "watch an ad
 * to keep using free tier" lever; subscription via RevenueCat removes the
 * interstitial entirely.
 *
 * AdMob configuration:
 *   App ID:        ca-app-pub-8156953772676654~5852038578  (manifest meta-data)
 *   Interstitial:  ca-app-pub-8156953772676654/3180431755  (this module)
 *
 * ProGuard keep rules for AdMob live in mobile/proguard-rules.pro.
 */

import mobileAds, {
  MaxAdContentRating,
  TestIds,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Interstitial Ad Unit ID (production). */
export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-8156953772676654/3180431755';

/** Show an interstitial every Nth invoice saved in the month. */
export const INTERSTITIAL_EVERY_N_INVOICES = 4;

/** Minimum milliseconds between two interstitials (avoid spamming). */
const MIN_INTERVAL_BETWEEN_ADS_MS = 60_000;

/** Timeout waiting for an ad to load before giving up (ms). */
const AD_LOAD_TIMEOUT_MS = 8_000;

// ─── State ───────────────────────────────────────────────────────────────────

let initialized = false;
let lastShownAt = 0;

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Initialize the Google Mobile Ads SDK. Safe to call multiple times —
 * the SDK is initialized once. Should be called from app startup
 * (e.g. App.tsx useEffect) and from the splash path.
 */
export async function initAds(): Promise<void> {
  if (initialized) return;
  try {
    await mobileAds().initialize();
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    initialized = true;
  } catch (err) {
    console.warn('[ads] init failed — ads will not serve', err);
  }
}

// ─── Interstitial ────────────────────────────────────────────────────────────

/**
 * Show an interstitial ad if:
 *   1. the SDK is initialized,
 *   2. at least MIN_INTERVAL_BETWEEN_ADS_MS has passed since the last show,
 *   3. the ad loads successfully within AD_LOAD_TIMEOUT_MS.
 *
 * Returns true if an ad was actually shown, false otherwise (timeout, no fill,
 * throttled, or init not done). The caller should treat the return value as a
 * hint, not a guarantee — the user flow continues regardless.
 */
export async function maybeShowInterstitial(): Promise<boolean> {
  if (!initialized) {
    await initAds();
    if (!initialized) return false;
  }

  const now = Date.now();
  if (now - lastShownAt < MIN_INTERVAL_BETWEEN_ADS_MS) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    // Safety timeout — if the ad never loads, unblock the caller
    const timeoutHandle = setTimeout(() => {
      settle(false);
    }, AD_LOAD_TIMEOUT_MS);

    try {
      const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        unsubLoaded();
        unsubError();
        interstitial.show().then(() => {
          lastShownAt = Date.now();
          settle(true);
        }).catch(() => settle(false));
      });

      const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubLoaded();
        unsubError();
        settle(false);
      });

      interstitial.load();
    } catch (err) {
      console.warn('[ads] interstitial setup failed', err);
      settle(false);
    }
  });
}

// ─── Decision helper ─────────────────────────────────────────────────────────

/**
 * Decide whether to show an interstitial after this invoice save.
 *
 * @param invoicesThisMonth running count of invoices created this month,
 *                         INCLUDING the one just saved (caller passes the
 *                         post-save count).
 * @returns true if eligible (every Nth invoice, modulo logic), false otherwise.
 */
export function shouldShowInterstitialForInvoice(invoicesThisMonth: number): boolean {
  if (invoicesThisMonth <= 0) return false;
  return invoicesThisMonth % INTERSTITIAL_EVERY_N_INVOICES === 0;
}
