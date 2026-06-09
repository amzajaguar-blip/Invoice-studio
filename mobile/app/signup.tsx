import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignupScreen() {
  const { signUp, resendConfirmation, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState(null);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) { setError("Inserisci email e password"); return; }
    if (password !== confirmPassword) { setError("Le password non coincidono"); return; }
    if (password.length < 10) { setError("La password deve essere di almeno 10 caratteri"); return; }
    setError(null); setSuccess(null); setLoading(true);
    const result = await signUp(email.trim(), password);
    setLoading(false);
    if (result.error) { setError(result.error); }
    else { setSignedUpEmail(email.trim()); setSuccess("Registrazione completata! Controlla la tua email per confermare."); }
  };

  const handleResend = async () => {
    if (!signedUpEmail) return;
    setError(null); setSuccess(null); setLoading(true);
    const result = await resendConfirmation(signedUpEmail);
    setLoading(false);
    if (result.error) { setError(result.error); }
    else { setSuccess("Email reinviata! Controlla anche la cartella spam."); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.inner}>
        <Text style={s.logo}>S</Text>
        <Text style={s.title}>InvoiceStudio</Text>
        <Text style={s.subtitle}>Crea il tuo account gratuito</Text>
        <View style={s.form}>
          {!signedUpEmail ? (
            <>
              <TextInput style={s.input} placeholder="Email" placeholderTextColor="#6b7280" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <TextInput style={s.input} placeholder="Password (minimo 10 caratteri)" placeholderTextColor="#6b7280" secureTextEntry value={password} onChangeText={setPassword} />
              <TextInput style={s.input} placeholder="Ripeti Password" placeholderTextColor="#6b7280" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
              {error && <Text style={[s.message, { color: "#ef4444" }]}>{error}</Text>}
              <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buttonText}>Crea account gratuito</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.googleButton, loading && s.buttonDisabled]}
                onPress={async () => {
                  setError(null);
                  setLoading(true);
                  const res = await signInWithGoogle();
                  setLoading(false);
                  if (res.error) setError(res.error);
                }}
                disabled={loading}
              >
                <Text style={s.googleButtonText}>Registrati con Google</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {success && <Text style={[s.message, { color: "#22c55e" }]}>{success}</Text>}
              {error && <Text style={[s.message, { color: "#ef4444" }]}>{error}</Text>}
              <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleResend} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buttonText}>Non hai ricevuto l'email? Reinvia</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSignedUpEmail(null); setSuccess(null); setError(null); }}>
                <Text style={s.link}>Torna alla registrazione</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={s.link}>Hai gia un account? Accedi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0b0f" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logo: { fontSize: 40, color: "#6c63ff", textAlign: "center", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f0f0f2", textAlign: "center", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 32 },
  form: { gap: 12 },
  input: { backgroundColor: "#111318", borderWidth: 1, borderColor: "#1e2029", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#f0f0f2", fontSize: 15 },
  message: { fontSize: 13, textAlign: "center", paddingHorizontal: 8 },
  button: { backgroundColor: "#6c63ff", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  googleButton: { backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb", marginTop: 4 },
  googleButtonText: { color: "#0a0b0f", fontSize: 16, fontWeight: "600" },
  link: { color: "#6c63ff", fontSize: 13, textAlign: "center", marginTop: 4 },
});
