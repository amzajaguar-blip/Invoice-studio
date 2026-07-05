declare const global: {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
  };
};

import { Slot, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/ThemeContext";
import { ToastProvider } from "@/components/ToastProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { PlanProvider } from "@/context/PlanContext";
import { EngagementProvider } from "@/context/EngagementContext";
import { StartupErrorBoundary } from "@/app/components/StartupErrorBoundary";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import mobileAds, { AdsConsent, AdsConsentStatus } from "react-native-google-mobile-ads";
import Purchases from "react-native-purchases";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { initializePushNotifications } from "@/lib/notifications-service";
import { COLORS } from "../constants/theme";

const logBoot = (msg: string, data?: any) => {
  // eslint-disable-next-line no-console
  console.log(`[BOOT] ${msg}`, data !== undefined ? data : "");
};

const logBootError = (msg: string, err: any) => {
  // eslint-disable-next-line no-console
  console.error(`[BOOT ERROR] ${msg}`, err);
};

// BOOT_000: Module evaluated successfully — proves the JS bundle loaded.
// If this never appears in logcat, the problem is at the native/Hermes level.
logBoot("BOOT_000 Module loaded — JS bundle evaluated OK");

function AdMobInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    logBoot("AdMobInitializer init start");

    // Never let AdMob block the app UI. Show children after a short grace
    // period even if the SDK is still initializing, and keep trying in background.
    const unblockTimeout = setTimeout(() => {
      logBoot("AdMobInitializer unblocking UI after grace period");
      setReady(true);
    }, 1500);

    const initializeAds = async () => {
      try {
        logBoot("Requesting AdsConsent info");
        const consentInfo = await AdsConsent.requestInfoUpdate();
        
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdsConsentStatus.REQUIRED
        ) {
          logBoot("Showing AdsConsent form");
          await AdsConsent.showForm();
        }

        logBoot("Initializing mobileAds");
        await mobileAds().initialize();
        logBoot("AdMob initialized successfully");
      } catch (err) {
        logBootError("AdMob init error (non-fatal)", err);
      } finally {
        clearTimeout(unblockTimeout);
        setReady(true);
      }
    };

    initializeAds();

    return () => clearTimeout(unblockTimeout);
  }, []);

  if (!ready) {
    logBoot("AdMobInitializer showing brief spinner");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

function NotificationDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    logBoot("NotificationDeepLinkHandler init");
    initializePushNotifications()
      .then(() => logBoot("Push notifications initialized"))
      .catch((err) => logBootError("Push notifications init failed (non-fatal)", err));

    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data as any;
      if (data?.deepLink) {
        logBoot("Notification deep link", data.deepLink);
        router.push(data.deepLink as any);
      }
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

function AuthDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    logBoot("AuthDeepLinkHandler init");

    // SECURITY/RACE-FIX: il flusso Google OAuth viene già gestito interamente
    // da WebBrowser.openAuthSessionAsync dentro useAuth.tsx (signInWithGoogle):
    // lì il callback URL 'vela://auth/callback?code=...' viene letto, il code
    // scambiato con exchangeCodeForSession(), e onAuthStateChange popola la
    // sessione. NON deve esistere un secondo consumer che fa router.push su
    // /auth/callback, perché ciò monta il callback handler in contemporanea
    // al primo render di (tabs)/(TabLayout): il suo async handleCallback()
    // chiama router.replace() in mezzo al forceStoreRerender di @react-navigation,
    // e l'options object di Tabs.Screen arriva undefined a BottomTabNavigator
    // ("undefined is not a function" al primo render del TabLayout).
    const handleUrl = (event: { url: string }) => {
      try {
        logBoot("Auth deep link URL (ignored — handled by WebBrowser flow)", event.url);
      } catch (err) {
        logBootError("Auth deep link parse error (non-fatal)", err);
      }
    };

    const sub = Linking.addEventListener("url", handleUrl);

    // Non fare MAI push su /auth/callback in cold start: il login è già
    // stato completato da WebBrowser e la sessione è già attiva in storage.
    // Lasciamo che il listener onAuthStateChange di useAuth monti (tabs).
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("auth/callback")) {
        logBoot("Cold-start callback URL — skipped, session already set by WebBrowser");
      } else if (url) {
        handleUrl({ url });
      }
    }).catch((err) => logBootError("getInitialURL failed (non-fatal)", err));

    return () => sub.remove();
  }, [router]);

  return null;
}

/** Inline checkpoint tracer — renders null, just logs mount. */
function BootCheckpoint({ id, label }: { id: string; label: string }) {
  useEffect(() => {
    logBoot(`${id} ${label} mounted`);
  }, []);
  return null;
}

export default function RootLayout() {
  logBoot("BOOT_001 RootLayout render start");

  useEffect(() => {
    // Capture JS errors that escape React's error boundary (e.g. native module throws)
    const originalHandler =
      global.ErrorUtils && typeof global.ErrorUtils.getGlobalHandler === "function"
        ? global.ErrorUtils.getGlobalHandler()
        : undefined;

    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === "function") {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        logBootError(`Global JS error (fatal=${isFatal})`, error);
        if (originalHandler) originalHandler(error, isFatal);
      });
    }

    logBoot("BOOT_002 RootLayout useEffect running");
    if (Platform.OS === "android") {
      try {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
        if (apiKey) {
          Purchases.configure({ apiKey });
          logBoot("BOOT_002a RevenueCat configured");
        } else {
          logBootError("RevenueCat init failed: Missing API key", null);
        }
      } catch (err) {
        logBootError("RevenueCat init failed (non-fatal)", err);
      }
    }
  }, []);

  return (
    <StartupErrorBoundary>
      <BootCheckpoint id="BOOT_003" label="StartupErrorBoundary" />
      <ThemeProvider>
        <BootCheckpoint id="BOOT_004" label="ThemeProvider" />
        <AuthProvider>
          <BootCheckpoint id="BOOT_005" label="AuthProvider" />
          <ToastProvider>
            <BootCheckpoint id="BOOT_006" label="ToastProvider" />
            <PlanProvider>
              <BootCheckpoint id="BOOT_007" label="PlanProvider" />
              <EngagementProvider>
                <BootCheckpoint id="BOOT_008" label="EngagementProvider" />
                <LocaleProvider>
                  <BootCheckpoint id="BOOT_009" label="LocaleProvider" />
                  <StatusBar style="auto" />
                  <NotificationDeepLinkHandler />
                  <AuthDeepLinkHandler />
                  <AdMobInitializer>
                    <BootCheckpoint id="BOOT_010" label="AdMobInitializer" />
                    {/* Stack è già configurato dentro i layout figli
                        (auth)/_layout e (app)/_layout. Usare Slot puro qui
                        evita la nidificazione causa del forceStoreRerender
                        race "undefined is not a function at TabLayout". */}
                    <Slot />
                  </AdMobInitializer>
                </LocaleProvider>
              </EngagementProvider>
            </PlanProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </StartupErrorBoundary>
  );
}
