import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/lib/toast";
import { extractFragmentAuthParams } from "@/lib/auth-deep-link";

/**
 * Reset password screen — passo 2 del flusso.
 *
 * L'utente arriva qui dal link email di Supabase (deep link tipo
 * `vela://(auth)/reset-password#access_token=...&refresh_token=...&type=recovery`).
 *
 * La sessione di recovery popola automaticamente lo storage di Supabase
 * via il Supabase client stesso (detectSessionInUrl gestisce il fragment
 * se siamo nella web/Linking context). Sul mobile native, il client ha
 * detectSessionInUrl: false (vedi lib/supabase.ts), quindi estraiamo
 * manualmente i token dal fragment dell'URL con expo-linking e li passiamo
 * a setSession().
 *
 * Una volta che c'è una sessione attiva, l'utente inserisce la nuova
 * password e viene chiamato updateUser({ password }).
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true); // session-recovery iniziale
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Evita di gestire due volte i token se l'utente arriva con cold-start
  // (Linking.getInitialURL) e poi riceve un evento 'url' in rapida successione.
  const handledRef = useRef(false);

  useEffect(() => {
    const tryEstablishSession = async (url?: string) => {
      if (handledRef.current) return;
      const params = url ? extractFragmentAuthParams(url) : null;

      // Se l'URL contiene token espliciti li impostiamo manualmente.
      // Altrimenti proviamo a leggere la sessione corrente (cold start
      // con auth già attiva da WebBrowser precedente).
      if (params?.access_token && params?.refresh_token) {
        handledRef.current = true;
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionError) {
          setInvalidLink(true);
        } else {
          setSessionReady(true);
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          handledRef.current = true;
          setSessionReady(true);
        } else {
          setInvalidLink(true);
        }
      }
      setLoading(false);
    };

    // Cold-start: URL di apertura app
    import("expo-linking")
      .then((Linking) => Linking.getInitialURL())
      .then((url) => {
        if (url) {
          tryEstablishSession(url);
        } else {
          tryEstablishSession();
        }
      })
      .catch(() => tryEstablishSession());
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < 8) {
      setError(t("reset.password_too_short"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("reset.passwords_mismatch"));
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Pulizia della sessione di recovery: dopo il cambio password è buona
    // prassi far rifare il login con la nuova credenziale. Manteniamo
    // la sessione corrente per un attimo per poi fare signOut.
    setSuccess(true);
    showToast({ message: t("reset.success.title"), type: "success" });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (invalidLink) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{t("reset.invalid_link.title")}</Text>
              <Text style={styles.subtitle}>{t("reset.invalid_link.body")}</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/(auth)/forgot-password")}
            >
              <Text style={styles.primaryButtonText}>
                {t("reset.invalid_link.back_to_login")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (success) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.title}>{t("reset.success.title")}</Text>
              <Text style={styles.subtitle}>{t("reset.success.body")}</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={async () => {
                await supabase.auth.signOut();
                router.replace("/(auth)/login");
              }}
            >
              <Text style={styles.primaryButtonText}>
                {t("reset.success.go_to_login")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("reset.forgot.title")}</Text>
            <Text style={styles.subtitle}>{t("reset.forgot.subtitle")}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("reset.forgot.email_label")}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!submitting && sessionReady}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t("reset.forgot.email_label")}</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!submitting && sessionReady}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (!sessionReady || submitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!sessionReady || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t("reset.forgot.submit")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "#0f1117",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 16,
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0f0f2",
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
});
