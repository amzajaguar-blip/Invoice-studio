import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { session, loading } = useAuth();

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
      <Stack.Screen name="clients" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}
