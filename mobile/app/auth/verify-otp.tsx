import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/ThemeContext";
import { supabase } from "@/lib/supabase";
import { StatusBar } from "expo-status-bar";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { colors, resolvedTheme } = useTheme();
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const email = params.email ?? "";
  const mode = params.mode ?? "signup";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // Auto-focus input when screen mounts
    const timer = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = async () => {
    if (!email) {
      setError("Email mancante. Torna indietro e riprova.");
      return;
    }
    if (code.length < 6) {
      setError("Inserisci il codice di 6 cifre.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: mode === "recovery" ? "recovery" : "signup",
      });

      if (verifyError) {
        setError(translateError(verifyError.message));
      } else {
        // Successfully verified
        router.replace("/(app)/(tabs)");
      }
    } catch {
      setError("Errore durante la verifica. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Email mancante.");
      return;
    }

    setResendLoading(true);
    setError(null);

    try {
      if (mode === "recovery") {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(
          email
        );
        if (resendError) {
          setError(translateError(resendError.message));
        } else {
          setCountdown(60);
        }
      } else {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
        });
        if (resendError) {
          setError(translateError(resendError.message));
        } else {
          setCountdown(60);
        }
      }
    } catch {
      setError("Errore durante il reinvio. Riprova.");
    } finally {
      setResendLoading(false);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="mail-outline"
              size={48}
              color={colors.accent}
            />
          </View>

          <Text style={styles.title}>Verifica la tua email</Text>
          <Text style={styles.subtitle}>
            Inserisci il codice di 6 cifre inviato a{" "}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons
              name="key-outline"
              size={20}
              color={colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Verifica</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Non hai ricevuto il codice?</Text>
            <Pressable
              onPress={handleResend}
              disabled={countdown > 0 || resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.resendLink,
                    countdown > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  {countdown > 0
                    ? `Reinvia tra ${countdown}s`
                    : "Reinvia codice"}
                </Text>
              )}
            </Pressable>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.backText}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function translateError(message: string): string {
  const map: Record<string, string> = {
    "Token has expired or is invalid": "Codice non valido o scaduto. Richiedine uno nuovo.",
    "Invalid token": "Codice non valido. Controlla e riprova.",
    "User not found": "Utente non trovato. Registrati di nuovo.",
    "Email not confirmed": "Email non confermata.",
    "For security purposes, you can only request this after": "Troppi tentativi. Riprova più tardi.",
  };
  return map[message] ?? message;
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 20,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentSubtle,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 8,
    },
    emailHighlight: {
      color: colors.accent,
      fontWeight: "600",
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      paddingHorizontal: 16,
      height: 56,
      marginTop: 8,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 20,
      letterSpacing: 8,
      fontWeight: "600",
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      borderRadius: 8,
      padding: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      flex: 1,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      height: 52,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
    resendContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    resendText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    resendLink: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    resendLinkDisabled: {
      color: colors.textMuted,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 24,
    },
    backText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  });
}
