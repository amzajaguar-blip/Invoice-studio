import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import mobileAds from "react-native-google-mobile-ads";

function AdMobInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    mobileAds()
      .initialize()
      .then(() => setReady(true))
      .catch((err) => {
        console.error("AdMob init failed:", err);
        setReady(true); // continue anyway, ads will try to load later
      });
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
