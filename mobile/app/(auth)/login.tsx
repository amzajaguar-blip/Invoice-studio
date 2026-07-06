import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Svg, { Path } from "react-native-svg";
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
  const { signInWithGoogle } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res.error) setError(res.error);
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
            <Text style={styles.title}>VELA</Text>
            <Text style={styles.subtitle}>Accedi con Google per continuare</Text>
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.disabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1f2937" />
            ) : (
              <GoogleIcon size={20} />
            )}
            <Text style={styles.googleButtonText}>Accedi con Google</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
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
    textAlign: "center",
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
    marginTop: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
});
