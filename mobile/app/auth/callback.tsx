import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    // Il code PKCE viene scambiato in signInWithGoogle (useAuth.tsx).
    // Qui controlliamo solo se la sessione è già presente.
    const check = async () => {
      // Retry per max 3 secondi — SecureStore può essere lento su dispositivi vecchi
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/(app)/(tabs)");
          return;
        }
      }
      router.replace("/login");
    };
    check();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6c63ff" />
      <Text style={styles.text}>Accesso in corso…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f", justifyContent: "center", alignItems: "center", gap: 16 },
  text: { color: "#9ca3af", fontSize: 14 },
});
