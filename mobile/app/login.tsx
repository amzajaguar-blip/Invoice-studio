import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Svg, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
  const { signIn, resetPassword, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Inserisci email e password");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Inserisci la tua email per ricevere il link di reset");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Email inviata! Controlla la tua casella di posta.");
      setResetMode(false);
    }
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
          {resetMode ? "Reimposta la password" : "Accedi al tuo account"}
        </Text>

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
          {!resetMode && (
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          )}

          {error && <Text style={[styles.message, { color: "#ef4444" }]}>{error}</Text>}
          {success && <Text style={[styles.message, { color: "#22c55e" }]}>{success}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={resetMode ? handleResetPassword : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>{resetMode ? "Invia email di reset" : "Accedi"}</Text>
            )}
          </TouchableOpacity>

          {!resetMode && (
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={async () => {
                setError(null);
                setLoading(true);
                const res = await signInWithGoogle();
                setLoading(false);
                if (res.error) setError(res.error);
              }}
              disabled={loading}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </Svg>
              <Text style={styles.googleButtonText}>Accedi con Google</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setResetMode(!resetMode); setError(null); setSuccess(null); }}>
            <Text style={styles.link}>{resetMode ? "Torna al login" : "Password dimenticata?"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.link}>Non hai un account? Registrati</Text>
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
  message: {
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
  googleButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 4,
  },
  googleButtonText: {
    color: "#0a0b0f",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#6c63ff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
