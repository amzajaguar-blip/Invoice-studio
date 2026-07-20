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

import mobileAds, { MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Interstitial Ad Unit ID (production). */
export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-8156953772676654/3180431755';

/** Show an interstitial every Nth invoice saved in the month. */
export const INTERSTITIAL_EVERY_N_INVOICES = 4;

/** Minimum milliseconds between two interstitials (avoid spamming). */
const MIN_INTERVAL_BETWEEN_ADS_MS = 60_000;

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
    await mobileAds()
      .setRequestConfiguration({
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
 *   3. the ad loads successfully within the timeout.
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

  try {
    const interstitial = await mobileAds().loadAd(
      mobileAds().InterstitialAd,
      {
        adUnitId: INTERSTITIAL_AD_UNIT_ID,
        requestOptions: { requestNonPersonalizedAdsOnly: false },
      },
    );

    if (!interstitial) return false;

    await interstitial.show();
    lastShownAt = Date.now();
    return true;
  } catch (err) {
    // Common reasons: no fill, network, ad unit not approved yet. Don't
    // interrupt the user's flow; just log.
    console.warn('[ads] interstitial failed to load/show', err);
    return false;
  }
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
