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
} from "react-native";
import { Svg, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignupScreen() {
  const { signUp, resendConfirmation, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Compila tutti i campi");
      return;
    }
    if (password.length < 10) {
      setError("La password deve essere di almeno 10 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    if (!termsAccepted) {
      setError("Devi accettare i Termini di Servizio e la Privacy Policy");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await signUp(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSignedUpEmail(email.trim());
      setSuccess(
        "Registrazione completata! Controlla la tua email per verificare l'account."
      );
    }
  };

  const handleResend = async () => {
    if (!signedUpEmail) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await resendConfirmation(signedUpEmail);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Email reinviata! Controlla anche la cartella spam.");
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
            <Text style={styles.subtitle}>Crea il tuo account gratuito</Text>
          </View>

          {!signedUpEmail ? (
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
                disabled={loading}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </Svg>
                <Text style={styles.googleButtonText}>Registrati con Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>O registrati con email</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Form */}
              <View style={styles.form}>
                <View>
                  <Text style={styles.label}>Nome completo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Marco Bianchi"
                    placeholderTextColor="#6b7280"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

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

                <View>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Almeno 10 caratteri"
                      placeholderTextColor="#6b7280"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((v) => !v)}
                    >
                      <Text style={styles.eyeIcon}>
                        {showPassword ? "🙈" : "👁"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={styles.label}>Conferma Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ripeti la password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                {/* Terms checkbox */}
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setTermsAccepted((v) => !v)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      termsAccepted && styles.checkboxChecked,
                    ]}
                  >
                    {termsAccepted && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.termsText}>
                    Accetto i Termini di Servizio e la Privacy Policy
                  </Text>
                </TouchableOpacity>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    (loading || !termsAccepted) && styles.disabled,
                  ]}
                  onPress={handleSignup}
                  disabled={loading || !termsAccepted}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Crea account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.form}>
              {success && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{success}</Text>
                </View>
              )}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.button, loading && styles.disabled]}
                onPress={handleResend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    Non hai ricevuto l'email? Reinvia
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSignedUpEmail(null);
                  setSuccess(null);
                  setError(null);
                }}
              >
                <Text style={styles.backLink}>Torna alla registrazione</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.push("/login")}
            style={{ marginTop: 20 }}
          >
            <Text style={styles.loginLink}>
              Hai già un account? Accedi
            </Text>
          </TouchableOpacity>
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
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  termsText: {
    color: "#6b7280",
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
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
  backLink: {
    color: "#6c63ff",
    fontSize: 13,
    textAlign: "center",
  },
  loginLink: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
  },
});
