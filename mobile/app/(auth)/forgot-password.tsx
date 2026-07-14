import { useState } from "react";
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

/**
 * Forgot password screen — passo 1 del flusso di reset.
 *
 * L'utente inserisce la propria email e Supabase invia un'email contenente
 * un link con token di recovery. Il link apre `/(auth)/reset-password`,
 * che poi chiama `supabase.auth.updateUser({ password })`.
 *
 * NOTA: questo flusso funziona solo per account email/password.
 * Gli account Google OAuth non hanno una password da reimpostare.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !email.includes("@")) {
      setError(t("reset.forgot.error"));
      return;
    }

    setLoading(true);
    // redirectTo deve essere una deep link che la nostra app può aprire.
    // Lo schema custom `vela` è registrato in app.json > android > intentFilters
    // e in iOS via expo-linking. La rotta /(auth)/reset-password accetta
    // il token via hash fragment (#access_token=...&type=recovery&...).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: "vela://(auth)/reset-password",
      }
    );
    setLoading(false);

    if (resetError) {
      // Non esponiamo se l'email esiste o meno — la pagina di successo
      // è la stessa per mitigare user enumeration.
      setError(t("reset.forgot.error"));
      return;
    }

    setSent(true);
    showToast({ message: t("reset.forgot.success_title"), type: "success" });
  };

  if (sent) {
    const successBody = t("reset.forgot.success_body").replace("{email}", email);
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
              <Text style={styles.successIcon}>📧</Text>
              <Text style={styles.title}>{t("reset.forgot.success_title")}</Text>
              <Text style={styles.subtitle}>{successBody}</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.primaryButtonText}>
                {t("reset.forgot.back_to_login")}
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
              value={email}
              onChangeText={setEmail}
              placeholder={t("reset.forgot.email_placeholder")}
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t("reset.forgot.submit")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace("/(auth)/login")}
            disabled={loading}
          >
            <Text style={styles.linkButtonText}>
              {t("reset.forgot.back_to_login")}
            </Text>
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
  linkButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  linkButtonText: {
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: "500",
  },
});
