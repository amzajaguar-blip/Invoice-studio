import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Inserisci email e password");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    setError(null);
    setLoading(true);

    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (isSignUp) {
      setError("✅ Registrazione completata! Controlla la tua email per confermare.");
    }
    // On successful sign-in, expo-router auto-redirects via (app) layout
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <Text style={styles.logo}>✦</Text>
        <Text style={styles.title}>InvoiceStudio</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Crea il tuo account" : "Accedi al tuo account"}
        </Text>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Ripeti Password"
              placeholderTextColor="#6b7280"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          )}

          {error && (
            <Text
              style={[
                styles.error,
                { color: error.startsWith("✅") ? "#22c55e" : "#ef4444" },
              ]}
            >
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "..." : isSignUp ? "Registrati" : "Accedi"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(null); }}>
            <Text style={styles.toggle}>
              {isSignUp
                ? "Hai già un account? Accedi"
                : "Non hai un account? Registrati"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 40,
    color: "#6c63ff",
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f0f0f2",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#1e2029",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f0f0f2",
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  toggle: {
    color: "#6c63ff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});
