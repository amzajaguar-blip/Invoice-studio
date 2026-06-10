import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

/**
 * Gestisce il redirect da Supabase Google OAuth.
 * URL ricevuto: invoicestudio://auth/callback?code=XXXX
 *
 * Expo Router atterra qui dopo che l'utente completa il login Google
 * nel browser. Legge il code PKCE dall'URL, lo scambia con una sessione
 * Supabase, poi manda alla dashboard.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const parsed = new URL(url);
          const code = parsed.searchParams.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          }
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/(app)/(tabs)");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
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
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    color: "#9ca3af",
    fontSize: 14,
  },
});
