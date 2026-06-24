declare const global: {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
  };
};

import { Stack, useRouter } from "expo-router";
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
import mobileAds from "react-native-google-mobile-ads";
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
    }, 800);

    const initTimeout = setTimeout(() => {
      logBootError("AdMobInitializer init timed out (5s)", null);
    }, 5000);

    try {
      mobileAds()
        .initialize()
        .then(() => {
          clearTimeout(unblockTimeout);
          clearTimeout(initTimeout);
          logBoot("AdMob initialized successfully");
          setReady(true);
        })
        .catch((err) => {
          clearTimeout(unblockTimeout);
          clearTimeout(initTimeout);
          logBootError("AdMob init promise rejected (non-fatal)", err);
          setReady(true);
        });
    } catch (err) {
      clearTimeout(unblockTimeout);
      clearTimeout(initTimeout);
      logBootError("AdMob init synchronous throw (non-fatal)", err);
      setReady(true);
    }

    return () => {
      clearTimeout(unblockTimeout);
      clearTimeout(initTimeout);
    };
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

    const handleUrl = (event: { url: string }) => {
      try {
        logBoot("Auth deep link URL", event.url);
        const parsed = new URL(event.url);
        const path = parsed.pathname || parsed.hostname;

        if (path.includes("auth/callback")) {
          router.push("/auth/callback" as any);
        }
      } catch (err) {
        logBootError("Auth deep link parse error (non-fatal)", err);
      }
    };

    const sub = Linking.addEventListener("url", handleUrl);

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
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
        Purchases.configure({ apiKey: "goog_jQbcLtPLxDFDpSxwHblTiWwaDhw" });
        logBoot("BOOT_002a RevenueCat configured");
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
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: "transparent" },
                        animation: "fade",
                      }}
                    />
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
