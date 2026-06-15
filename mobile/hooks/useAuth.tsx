import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

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
    // Get initial session from SecureStore
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes — ignora solo INITIAL_SESSION
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;
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
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  };

  const signInWithGoogle = async () => {
    const redirectUrl = "invoicestudio://auth/callback";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: translateAuthError(error.message) };
    if (!data?.url) return { error: "Impossibile avviare il login con Google. Riprova." };

    let res;
    try {
      res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    } catch {
      return { error: "Impossibile aprire il browser. Verifica che sia installato un browser sul dispositivo." };
    }

    if (res.type === "cancel") return {};

    if (res.type === "dismiss") {
      return { error: "Il browser si è chiuso prima di completare l'accesso. Riprova." };
    }

    if (res.type === "success" && res.url) {
      const urlObj = new URL(res.url);
      const code = urlObj.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) return { error: translateAuthError(exchangeError.message) };
        return {};
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) return {};
      return { error: "Login con Google non completato. Riprova." };
    }

    return {};
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
