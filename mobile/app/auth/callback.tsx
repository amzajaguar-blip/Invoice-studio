import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Prova a scambiare il code dal deep link (fallback se il listener non l'ha fatto)
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const parsed = new URL(url);
          const code = parsed.searchParams.get("code");
          if (code) {
            // Ignora errore se il code è già stato scambiato dal listener
            await supabase.auth.exchangeCodeForSession(code).catch(() => {});
          }
          // Implicit flow: token nel fragment
          const hash = parsed.hash?.replace(/^#/, "");
          if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {});
            }
          }
        }
      } catch { /* ignore */ }

      // Retry per max 10 secondi — aspetta che il listener in useAuth.tsx completi
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/(app)/(tabs)");
          return;
        }
      }
      router.replace("/login");
    };

    handleCallback();
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
