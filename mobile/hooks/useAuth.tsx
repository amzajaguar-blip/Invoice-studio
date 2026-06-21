import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

// NOTE: Do NOT call WebBrowser.maybeCompleteAuthSession() here at module scope.
// Module-scope execution runs during Hermes bundle evaluation — before React mounts
// and before any error boundary exists. A crash here produces a silent white screen.
// The call is made inside AuthProvider's useEffect (component lifecycle) instead.

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email o password non corretti. Verifica e riprova.",
    "Email not confirmed": "Email non ancora verificata. Controlla la tua casella di posta.",
    "Invalid email or password": "Email o password non corretti. Verifica e riprova.",
    "User not found": "Nessun account trovato con questa email. Verifica o registrati.",
    "User already registered": "Email giÃ  registrata. Prova ad accedere.",
    "Password should be at least 10 characters": "La password deve essere di almeno 10 caratteri.",
    "Unable to validate email address": "Email non valida. Controlla e riprova.",
  };
  return map[message] ?? message;
}

// âââ Auth Context âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: "not initialized" }),
  signUp: async () => ({ error: "not initialized" }),
  signOut: async () => {},
  resetPassword: async () => ({ error: "not initialized" }),
  resendConfirmation: async () => ({ error: "not initialized" }),
  signInWithGoogle: async () => ({ error: "not initialized" }),
});

// âââ Provider âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Complete auth session inside component lifecycle, not at module scope.
    // This is safe here because React has already mounted and error boundaries exist.
    try {
      WebBrowser.maybeCompleteAuthSession();
    } catch (err) {
      console.error("[BOOT ERROR] maybeCompleteAuthSession failed (non-fatal)", err);
    }

    console.log("[BOOT] AuthProvider useEffect starting");
    // Get initial session from SecureStore
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log("[BOOT] AuthProvider session loaded", session ? "authenticated" : "no session");
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[BOOT ERROR] AuthProvider getSession failed", err);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    // Listen for auth changes — ignora solo INITIAL_SESSION
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;
        console.log("[BOOT] AuthProvider auth state changed", event);
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = Linking.createURL("/auth/callback");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = Linking.createURL("/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  };

  const resendConfirmation = async (email: string) => {
    const redirectUrl = Linking.createURL("/auth/callback");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  };

  const signInWithGoogle = async () => {
    const redirectUrl = Linking.createURL("/auth/callback");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    if (!data?.url) return { error: "Impossibile avviare il login con Google. Riprova." };

    // Usa browser nativo + Linking listener invece di Chrome Custom Tab.
    // Chrome Custom Tab su certi dispositivi non dispatcha custom scheme da 302 redirect.
    // Il browser nativo lo gestisce correttamente tramite l'intent-filter dell'app.
    return new Promise<{ error?: string }>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        if (sub) sub.remove();
        clearTimeout(timer);
      };

      const handleUrl = async (url: string) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        try {
          const urlObj = new URL(url);

          // PKCE flow: code come query param
          const code = urlObj.searchParams.get("code");
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              resolve({ error: translateAuthError(exchangeError.message) });
            } else {
              resolve({});
            }
            return;
          }

          // Implicit flow: token nel fragment (#access_token=...)
          const hash = urlObj.hash?.replace(/^#/, "");
          if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) {
                resolve({ error: translateAuthError(sessionError.message) });
              } else {
                resolve({});
              }
              return;
            }
          }

          // Fallback: check se sessione già presente
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            resolve({});
          } else {
            resolve({ error: "Login con Google non completato. Riprova." });
          }
        } catch {
          resolve({ error: "Errore durante il login con Google. Riprova." });
        }
      };

      // Timeout: se l'utente non completa l'auth entro 5 minuti
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ error: "Timeout: il login non è stato completato." });
      }, 300000);

      // Listener per il deep link di ritorno
      const sub = Linking.addEventListener("url", (event) => {
        handleUrl(event.url);
      });

      // Apri URL OAuth nel browser nativo
      Linking.openURL(data.url).catch(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ error: "Impossibile aprire il browser. Verifica che sia installato un browser sul dispositivo." });
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
