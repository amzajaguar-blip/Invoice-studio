import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { initializePushNotifications } from "@/lib/notifications-service";
import { recordAppSessionAndMaybeAskReview } from "@/lib/review-prompt";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

export default function AuthLayout() {
  const { session, user, loading } = useAuth();

  useEffect(() => {
    if (session) {
      initializePushNotifications().catch(() => {});
    }
  }, [session]);

  // Conta questa sessione app e, dopo qualche sessione, chiede la recensione
  // con stelle (prompt nativo store, vedi lib/review-prompt.ts). Il ref
  // impedisce di contare due volte la stessa sessione se `user` cambia
  // riferimento senza che sia un vero nuovo login (es. refresh del token).
  const reviewPromptSessionUserId = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id && reviewPromptSessionUserId.current !== user.id) {
      reviewPromptSessionUserId.current = user.id;
      recordAppSessionAndMaybeAskReview(user.id).catch(() => {});
    }
  }, [user?.id]);

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
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* IMPORTANT: only register OUT-OF-tabs screens here. Tab routes
            (invoices, clients, settings) live inside (tabs)/_layout.tsx and
            MUST NOT be redeclared here — doing so creates a colliding
            descriptor map during cold boot whose .options is undefined,
            producing "undefined is not a function at TabLayout". See
            mobile/ROUTING_AUDIT.md items 2.1–2.3. */}
        <Stack.Screen name="generate" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="invoices/new" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="quotes/new" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="quotes/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="clients/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="[invoice]" options={{ presentation: "card", animation: "slide_from_right" }} />
      </Stack>
      {/* Tutorial breve al primo avvio — auto-contenuto, decide da solo se
          mostrarsi in base al flag AsyncStorage locale. */}
      <OnboardingTutorial />
    </>
  );
}
