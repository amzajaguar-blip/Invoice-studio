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
import { LocaleProvider, useLocale } from "@/components/LocaleProvider";
import { PlanProvider } from "@/context/PlanContext";
import { EngagementProvider } from "@/context/EngagementContext";
import { StartupErrorBoundary } from "@/app/components/StartupErrorBoundary";
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases from "react-native-purchases";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { initializePushNotifications } from "@/lib/notifications-service";

const logBoot = (msg: string, data?: any) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[BOOT] ${msg}`, data !== undefined ? data : "");
  }
};

const logBootError = (msg: string, err: any) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(`[BOOT ERROR] ${msg}`, err);
  }
};

// BOOT_000: Module evaluated successfully — proves the JS bundle loaded.
// If this never appears in logcat, the problem is at the native/Hermes level.
logBoot("BOOT_000 Module loaded — JS bundle evaluated OK");

function NotificationDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    logBoot("NotificationDeepLinkHandler init");
    initializePushNotifications()
      .then(() => logBoot("Push notifications initialized"))
      .catch((err) => logBootError("Push notifications init failed (non-fatal)", err));

    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data as any;
      if (data?.deepLink && typeof data.deepLink === "string") {
        const link = data.deepLink as string;
        const ALLOWED_DEEP_LINK_PREFIXES = [
          "/(app)/(tabs)",
          "/(app)/invoices",
          "/(app)/clients",
          "/(app)/quotes",
          "/(app)/scanner",
          "/(app)/ProUpgrade",
          "/(app)/PremiumPreview",
        ];
        const isAllowed = ALLOWED_DEEP_LINK_PREFIXES.some(
          (prefix) => link === prefix || link.startsWith(prefix + "/")
        );
        if (isAllowed) {
          logBoot("Notification deep link", link);
          router.push(link as any);
        } else {
          logBootError("Deep link rejected — not in whitelist", link);
          router.push("/(app)/(tabs)" as any);
        }
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

/**
 * LocaleSlot — Slot di Expo Router legato alla lingua corrente.
 *
 * Rimonta l'intero sottoalbero di navigazione quando `locale` cambia,
 * così componenti che leggono il dizionario in modo statico al primo
 * render vengono ricreati e riflettono la nuova lingua senza riavvio
 * dell'app.
 *
 * Deve essere renderizzato DENTRO <LocaleProvider> perché usa useLocale().
 */
function LocaleSlot() {
  const { locale } = useLocale();
  return <Slot key={locale} />;
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

    // Configure RevenueCat for both iOS and Android
    try {
      // Read platform-specific API keys from app.json extra with env fallback
      const androidApiKey =
        (Constants.expoConfig?.extra?.revenueCatApiKey as string) ||
        process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
      const iosApiKey =
        (Constants.expoConfig?.extra?.revenueCatApiKeyIOS as string) ||
        process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;

      const apiKey = Platform.OS === "ios" ? iosApiKey : androidApiKey;

      if (apiKey) {
        Purchases.configure({ apiKey });
        logBoot(`BOOT_002a RevenueCat configured for ${Platform.OS}`);
      } else {
        logBootError(`RevenueCat init failed: Missing API key for ${Platform.OS}`, null);
      }
    } catch (err) {
      logBootError("RevenueCat init failed (non-fatal)", err);
    }
  }, []);

  return (
    <StartupErrorBoundary>
      <BootCheckpoint id="BOOT_003" label="StartupErrorBoundary" />
      <LocaleProvider>
        <BootCheckpoint id="BOOT_009" label="LocaleProvider" />
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
                  <StatusBar style="auto" />
                  <NotificationDeepLinkHandler />
                  <AuthDeepLinkHandler />
                  <LocaleSlot />
                </EngagementProvider>
              </PlanProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </StartupErrorBoundary>
  );
}
