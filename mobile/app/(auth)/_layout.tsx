import { useEffect, useRef } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const navigatedRef = useRef(false);

  // Guard contro redirect multiplo: Redirect di expo-router chiama
  // router.replace() in un useEffect, che può correre in concorrenza con
  // il primo mount di (tabs)/(TabLayout) e provocare forceStoreRerender
  // mid-flight che arriva con descriptor.options undefined a
  // BottomTabNavigator ("undefined is not a function" in TabLayout).
  // Risolviamo facendo redirect esplicito una sola volta, quando la
  // navigazione iniziale del primo render dell'AuthLayout è completa.
  useEffect(() => {
    if (session && !loading && !navigatedRef.current) {
      navigatedRef.current = true;
      router.replace("/(app)/(tabs)" as any);
    }
  }, [session, loading, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0b0f",
        }}
      >
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  // Se la session è impostata MA il redirect non è ancora avvenuto, mostra
  // ancora una schermata neutra per evitare il render di <Redirect/> durante
  // il primo mount — che è la causa della race. Il redirect partirà
  // dall'useEffect qui sopra dopo il mounting pulito.
  if (session) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0b0f",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
