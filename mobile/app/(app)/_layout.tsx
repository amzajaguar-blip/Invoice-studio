import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { initializePushNotifications } from "@/lib/notifications-service";

export default function AuthLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (session) {
      initializePushNotifications().catch(() => {});
    }
  }, [session]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0b0f" }}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="invoices" options={{ presentation: "modal" }} />
      <Stack.Screen name="invoices/new" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="quotes" options={{ presentation: "modal" }} />
      <Stack.Screen name="quotes/new" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="quotes/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="clients" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="[invoice]" options={{ presentation: "card", animation: "slide_from_right" }} />
    </Stack>
  );
}
