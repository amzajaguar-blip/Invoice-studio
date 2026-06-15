import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Try to get the URL from deep link params
        const url = await Linking.getInitialURL();

        if (url) {
          const parsed = new URL(url);

          // PKCE flow: code in query params
          const code = parsed.searchParams.get("code") || (params.code as string);
          if (code) {
            await supabase.auth.exchangeCodeForSession(code).catch(() => {});
          }

          // Implicit flow: tokens in hash fragment
          const hash = parsed.hash?.replace(/^#/, "");
          if (hash) {
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {});
            }
          }
        } else if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code as string).catch(() => {});
        } else if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          }).catch(() => {});
        }

        // Verify we have a valid session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setReady(true);
        } else {
          setError("Link non valido o scaduto. Richiedi un nuovo reset password.");
        }
      } catch {
        setError("Errore nel processare il link. Richiedi un nuovo reset password.");
      }
      setLoading(false);
    };

    init();
  }, []);

  const handleReset = async () => {
    if (!password.trim()) {
      setError("Inserisci la nuova password");
      return;
    }
    if (password.length < 10) {
      setError("La password deve essere di almeno 10 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      await supabase.auth.signOut();
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>Verifica del link...</Text>
      </View>
    );
  }

  if (success) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.outer}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>InvoiceStudio</Text>
              <Text style={styles.subtitle}>Password aggiornata!</Text>
            </View>
            <View style={styles.successBox}>
              <Text style={styles.successText}>La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password.</Text>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}>
              <Text style={styles.buttonText}>Vai al login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.outer}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>InvoiceStudio</Text>
            <Text style={styles.subtitle}>Imposta nuova password</Text>
          </View>

          {error ? (
            <View style={styles.form}>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}>
                <Text style={styles.buttonText}>Torna al login</Text>
              </TouchableOpacity>
            </View>
          ) : ready ? (
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Nuova password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Almeno 10 caratteri"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                    <Text style={styles.eyeIcon}>{showPassword ? "\u{1F648}" : "\u{1F441}"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={styles.label}>Conferma password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ripeti la nuova password"
                  placeholderTextColor="#6b7280"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, submitting && styles.disabled]}
                onPress={handleReset}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Aggiorna password</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  outer: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0b0f", gap: 16 },
  loadingText: { color: "#9ca3af", fontSize: 14 },
  card: { backgroundColor: "#0f1117", borderWidth: 1, borderColor: "#1e2029", borderRadius: 16, padding: 24 },
  header: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f0f0f2", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 8 },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: "500", color: "#e5e7eb", marginBottom: 6 },
  input: { backgroundColor: "#111318", borderWidth: 1, borderColor: "#1e2029", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#f0f0f2", fontSize: 15 },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeButton: { position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 },
  eyeIcon: { fontSize: 18 },
  errorBox: { backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  errorText: { color: "#ef4444", fontSize: 13 },
  successBox: { backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  successText: { color: "#22c55e", fontSize: 13, lineHeight: 18 },
  button: { backgroundColor: "#6c63ff", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
});
