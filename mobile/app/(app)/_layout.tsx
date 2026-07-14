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
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* IMPORTANT: only register OUT-OF-tabs screens here. Tab routes
          (invoices, clients, settings) live inside (tabs)/_layout.tsx and
          MUST NOT be redeclared here — doing so creates a colliding
          descriptor map during cold boot whose .options is undefined,
          producing "undefined is not a function at TabLayout". See
          mobile/ROUTING_AUDIT.md items 2.1–2.3. */}
      <Stack.Screen name="invoices/new" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="quotes/new" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="quotes/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="clients/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="[invoice]" options={{ presentation: "card", animation: "slide_from_right" }} />
    </Stack>
  );
}
