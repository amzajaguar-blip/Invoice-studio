import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/ThemeContext";
import { ToastProvider } from "@/components/ToastProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { PlanProvider } from "@/context/PlanContext";
import { EngagementProvider } from "@/context/EngagementContext";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import Purchases from "react-native-purchases";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { initializePushNotifications } from "@/lib/notifications-service";
import { COLORS } from "../constants/theme";

function AdMobInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 5000);
    mobileAds()
      .initialize()
      .then(() => { clearTimeout(timeout); setReady(true); })
      .catch((err) => {
        clearTimeout(timeout);
        console.error("AdMob init failed:", err);
        setReady(true);
      });
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) {
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
    // Initialize push notifications at app startup
    initializePushNotifications().catch(() => {});

    // Listen for notification taps (foreground + background)
    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data as any;
      if (data?.deepLink) {
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
    // Handle deep links when app is already open (warm start)
    const handleUrl = (event: { url: string }) => {
      try {
        const parsed = new URL(event.url);
        const path = parsed.pathname || parsed.hostname;

        // Route auth email links to appropriate screens
        if (path.includes("reset-password")) {
          const code = parsed.searchParams.get("code");
          const hash = parsed.hash?.replace(/^#/, "");
          const hashParams = hash ? new URLSearchParams(hash) : null;
          const accessToken = hashParams?.get("access_token");
          const refreshToken = hashParams?.get("refresh_token");

          if (code) {
            router.push(`/reset-password?code=${code}` as any);
          } else if (accessToken && refreshToken) {
            router.push(`/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}` as any);
          }
        } else if (path.includes("auth/callback")) {
          router.push("/auth/callback" as any);
        }
      } catch { /* ignore malformed URLs */ }
    };

    const sub = Linking.addEventListener("url", handleUrl);

    // Also handle the URL that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "android") {
      Purchases.configure({ apiKey: "goog_jQbcLtPLxDFDpSxwHblTiWwaDhw" });
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <PlanProvider>
          <EngagementProvider>
            <ToastProvider>
              <LocaleProvider>
              <StatusBar style="auto" />
              <NotificationDeepLinkHandler />
              <AuthDeepLinkHandler />
              <AdMobInitializer>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "transparent" },
                    animation: "fade",
                  }}
                />
              </AdMobInitializer>
              </LocaleProvider>
            </ToastProvider>
          </EngagementProvider>
        </PlanProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
