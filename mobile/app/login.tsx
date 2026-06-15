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
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

/** Logo Google ufficiale — react-native-svg è nel package.json ed è
 *  linkato automaticamente da expo prebuild durante la build AAB. */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </Svg>
  );
}

export default function LoginScreen() {
  const { signIn, resetPassword, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleLogin = async () => {
    if (cooldown > 0) return;
    if (!email.trim() || !password.trim()) {
      setError("Inserisci email e password");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setCooldown(60);
        setAttempts(0);
        setError("Troppi tentativi. Riprova tra 60 secondi.");
      } else {
        setError(result.error);
      }
    }
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
      <View style={styles.outer}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>InvoiceStudio</Text>
            <Text style={styles.subtitle}>
              {resetMode ? "Reimposta la password" : "Accedi al tuo account"}
            </Text>
          </View>

          {!resetMode && (
            <>
              {/* Google button */}
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.disabled]}
                onPress={async () => {
                  setError(null);
                  setLoading(true);
                  const res = await signInWithGoogle();
                  setLoading(false);
                  if (res.error) setError(res.error);
                }}
                disabled={loading || cooldown > 0}
              >
                <GoogleIcon size={20} />
                <Text style={styles.googleButtonText}>Accedi con Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>O accedi con email</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="nome@studio.it"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {!resetMode && (
              <View>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{success}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (loading || cooldown > 0) && styles.disabled,
              ]}
              onPress={resetMode ? handleResetPassword : handleLogin}
              disabled={loading || cooldown > 0}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {cooldown > 0
                    ? `Riprova tra ${cooldown}s`
                    : resetMode
                    ? "Invia email di reset"
                    : "Accedi"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Bottom links */}
            <View style={styles.linksRow}>
              <TouchableOpacity
                onPress={() => {
                  setResetMode(!resetMode);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <Text style={styles.link}>
                  {resetMode ? "Torna al login" : "Password dimenticata?"}
                </Text>
              </TouchableOpacity>
            </View>

            {!resetMode && (
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.signupLink}>
                  Non hai un account? <Text style={{ fontWeight: "600", color: "#6c63ff" }}>Registrati</Text>
                </Text>
              </TouchableOpacity>
            )}

          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0b0f",
  },
  outer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f0f0f2",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  googleButtonText: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1e2029",
  },
  dividerText: {
    color: "#6b7280",
    fontSize: 13,
    paddingHorizontal: 12,
  },
  form: {
    gap: 16,
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
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  successBox: {
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successText: {
    color: "#22c55e",
    fontSize: 13,
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  link: {
    color: "#6c63ff",
    fontSize: 12,
  },
  signupLink: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});
