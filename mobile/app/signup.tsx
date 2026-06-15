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
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Inserisci email e password");
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
    setLoading(true);
    const result = await signUp(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.outer}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>InvoiceStudio</Text>
              <Text style={styles.subtitle}>Account creato!</Text>
            </View>
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Ti abbiamo inviato un'email di conferma. Controlla la tua casella di posta e clicca il link per attivare l'account.
              </Text>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}>
              <Text style={styles.buttonText}>Torna al login</Text>
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
            <Text style={styles.subtitle}>Crea il tuo account</Text>
          </View>

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
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                  <Text style={styles.eyeIcon}>{showPassword ? "\u{1F648}" : "\u{1F441}"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Conferma password</Text>
              <TextInput
                style={styles.input}
                placeholder="Ripeti la password"
                placeholderTextColor="#6b7280"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.disabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Registrati</Text>
              )}
            </TouchableOpacity>

            <View style={styles.linksRow}>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={styles.link}>Hai già un account? Accedi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  outer: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
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
  linksRow: { flexDirection: "row", justifyContent: "center" },
  link: { color: "#6c63ff", fontSize: 13 },
});
