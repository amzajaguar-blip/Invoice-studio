/**
 * ads.ts — AdMob interstitial helper for VELA freemium model.
 *
 * Shows an interstitial ad after the user saves their Nth invoice of the
 * calendar month (default: every 4th invoice). This is the "watch an ad
 * to keep using free tier" lever; subscription via RevenueCat removes the
 * interstitial entirely.
 *
 * AdMob configuration:
 *   App ID:        ca-app-pub-8156953772676654~4738629818  (manifest meta-data)
 *   Interstitial:  ca-app-pub-8156953772676654/6372493305  (this module)
 *
 * ProGuard keep rules for AdMob live in mobile/proguard-rules.pro.
 */

import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
  TestIds,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Interstitial Ad Unit ID (production). */
export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-8156953772676654/6372493305';

/** Show an interstitial every Nth invoice saved in the month. */
export const INTERSTITIAL_EVERY_N_INVOICES = 4;

/** Minimum milliseconds between two interstitials (avoid spamming). */
const MIN_INTERVAL_BETWEEN_ADS_MS = 60_000;

/** Timeout waiting for an ad to load before giving up (ms). */
const AD_LOAD_TIMEOUT_MS = 8_000;

// ─── State ───────────────────────────────────────────────────────────────────

let initialized = false;
let lastShownAt = 0;

/** Fired once when the SDK completes initialize(); cleared after dispatch. */
const initListeners = new Set<() => void>();

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Initialize the Google Mobile Ads SDK. Safe to call multiple times —
 * the SDK is initialized once. Should be called from app startup
 * (e.g. App.tsx useEffect) and from the splash path.
 *
 * GDPR compliance for EEA/UK/CH — AdMob now requires explicit consent
 * via the UMP SDK before serving personalised ads. We:
 *   1. gatherConsent() — fetches the latest consent status from Google's
 *      servers; if the user is in a regulated region and hasn't yet
 *      answered, it presents the consent form.
 *   2. setRequestConfiguration() — configures the SDK with the standard
 *      flags. requestNonPersonalizedAdsOnly is no longer exposed here
 *      (the SDK reads it from the consent status itself), so we just
 *      forward PG content rating + child/age flags.
 *   3. initialize() — boots the SDK.
 *
 * After this, every ad request picks up the consent choice automatically.
 */
export async function initAds(): Promise<void> {
  if (initialized) return;
  try {
    // 1. GDPR consent flow via Google UMP. On the first launch in EEA
    //    the user will see a consent dialog before ads ever load.
    await AdsConsent.gatherConsent();

    // 1b. Only proceed if the user has actually granted permission to
    //     request ads (declined/unresolved consent must not boot the SDK).
    const { canRequestAds } = await AdsConsent.getConsentInfo();
    if (!canRequestAds) return;

    // 2. Standard ad-request configuration.
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      ...(Platform.OS === 'ios' ? {} : {}), // reserved for iOS-specific flags
    });

    // 3. Boot the SDK.
    await mobileAds().initialize();
    initialized = true;
    initListeners.forEach((listener) => listener());
    initListeners.clear();

    // 4. Kick off the preloaded "generate" interstitial (best-effort — a
    //    failure here only means the first ad won't be instant).
    void preloadGenerateInterstitial();
  } catch (err) {
    console.warn('[ads] init failed — ads will not serve', err);
  }
}

/**
 * Re-present the privacy options form (the GDPR "Manage choices" entry
 * point that Google requires apps targeting EEA/UK/CH to expose somewhere
 * in their UI, e.g. a "Gestisci privacy annunci" button in Settings).
 */
export async function showPrivacyOptionsForm(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (err) {
    console.warn('[ads] showPrivacyOptionsForm failed', err);
  }
}

/**
 * Helper that reads the current consent status — useful for deciding
 * whether to expose a "Reimposta consenso annunci" action in Settings.
 * Returns one of AdsConsentStatus (UNKNOWN | REQUIRED | NOT_REQUIRED | OBTAINED).
 */
export async function getConsentStatus(): Promise<AdsConsentStatus> {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.status;
  } catch {
    return AdsConsentStatus.UNKNOWN;
  }
}

/**
 * True once the SDK has completed initialize() — which in this flow happens
 * only after UMP consent has been gathered. Gates ad components (banners) so
 * they never issue a request before consent + init have resolved.
 */
export function isAdsInitialized(): boolean {
  return initialized;
}

/**
 * Subscribe to SDK initialization. The listener fires once — immediately if
 * the SDK is already initialized. Returns an unsubscribe function.
 */
export function onAdsInitialized(listener: () => void): () => void {
  if (initialized) {
    listener();
    return () => {};
  }
  initListeners.add(listener);
  return () => {
    initListeners.delete(listener);
  };
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

// ─── Generate interstitial (preloaded) ───────────────────────────────────────

/**
 * Preloaded interstitial dedicated to the post-generation moment ("generate"
 * ad). Unlike maybeShowInterstitial() (load-on-demand), this ad is loaded in
 * advance so it can be shown instantly AFTER document generation completes —
 * never during an async operation, never offline, never for Pro users (the
 * premium gate lives in the caller, useDocumentAd).
 *
 * Lifecycle (RN mapping of the native FullScreenContentCallback):
 *   preloadGenerateInterstitial()       → load() + LOADED/ERROR listeners
 *   showGenerateInterstitialIfReady()   → show() only if ready + online
 *   AdEventType.CLOSED                  → onAdDismissedFullScreenContent:
 *                                         preload the next ad for later use
 *   show() promise rejection            → onAdFailedToShowFullScreenContent:
 *                                         cleanup + preload a fresh ad
 */

let generateAd: InterstitialAd | null = null;
let generateAdReady = false;
let generateAdLoading = false;

/**
 * Preload the "generate" interstitial. No-op if the SDK is not initialized
 * (UMP consent not resolved), an ad is already loaded/loading, or the device
 * is offline. Called automatically by initAds() and after each dismissal.
 */
export async function preloadGenerateInterstitial(): Promise<void> {
  if (!initialized) {
    await initAds();
    if (!initialized) return;
  }
  if (generateAdReady || generateAdLoading) return;

  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
  } catch {
    return;
  }

  generateAdLoading = true;
  try {
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      unsubLoaded();
      unsubError();
      generateAd = ad;
      generateAdReady = true;
      generateAdLoading = false;
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      unsubLoaded();
      unsubError();
      generateAd = null;
      generateAdReady = false;
      generateAdLoading = false;
      console.warn('[ads] generate interstitial failed to load', error);
    });

    ad.load();
  } catch (err) {
    generateAdLoading = false;
    console.warn('[ads] generate interstitial preload setup failed', err);
  }
}

/**
 * Show the preloaded "generate" interstitial if — and only if:
 *   1. the SDK is initialized (UMP consent resolved via initAds),
 *   2. an ad has finished preloading,
 *   3. at least MIN_INTERVAL_BETWEEN_ADS_MS has passed since the last
 *      interstitial (shared throttle with maybeShowInterstitial — same ad
 *      unit, so the same frequency cap applies),
 *   4. the device is online.
 *
 * Returns true if the ad was opened, false otherwise (not ready, throttled,
 * offline, or show failure). On dismissal (CLOSED) or show failure the next
 * ad is preloaded automatically. Never throws — the document flow must
 * continue regardless.
 */
export async function showGenerateInterstitialIfReady(): Promise<boolean> {
  if (!initialized || !generateAdReady || !generateAd) return false;

  const now = Date.now();
  if (now - lastShownAt < MIN_INTERVAL_BETWEEN_ADS_MS) return false;

  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;
  } catch {
    return false;
  }

  // Detach from module state before showing — a shown ad instance cannot be
  // reused, so the slot is cleared regardless of the outcome.
  const ad = generateAd;
  generateAd = null;
  generateAdReady = false;

  try {
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubClosed();
      // onAdDismissedFullScreenContent equivalent: preload the next ad.
      void preloadGenerateInterstitial();
    });

    await ad.show();
    lastShownAt = Date.now();
    return true;
  } catch (err) {
    // onAdFailedToShowFullScreenContent equivalent.
    console.warn('[ads] generate interstitial failed to show', err);
    void preloadGenerateInterstitial();
    return false;
  }
}
