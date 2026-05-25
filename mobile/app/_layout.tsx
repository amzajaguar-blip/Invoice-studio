import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import Purchases from "react-native-purchases";

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0b0f" }}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "android") {
      Purchases.configure({ apiKey: "goog_jQbcLtPLxDFDpSxwHblTiWwaDhw" });
    }
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AdMobInitializer>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0a0b0f" },
            animation: "fade",
          }}
        />
      </AdMobInitializer>
    </AuthProvider>
  );
}
