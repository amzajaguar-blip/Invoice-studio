import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Svg, Path } from "react-native-svg";
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
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </Svg>
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
