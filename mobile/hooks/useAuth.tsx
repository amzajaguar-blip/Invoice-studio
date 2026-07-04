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
  const map: Record<string, string> = {};
  return map[message] ?? message;
}

// âââ Auth Context âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
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

  const signOut = async () => {
    await supabase.auth.signOut();
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

    // Usa WebBrowser.openAuthSessionAsync invece di Linking.openURL:
    // gestisce correttamente il 302 finale su tutti i browser Android
    // (Chrome Custom Tab, Samsung Internet, Xiaomi MIUI Browser, ecc.)
    // e restituisce direttamente l'URL di callback, eliminando il loop
    // "caricamento in corso…" che si verificava quando il custom scheme
    // non veniva propagato dal browser all'app.
    // Aggiunto anche un timeout di 60s per evitare attese infinite.
    return new Promise<{ error?: string }>(async (resolve) => {
      let resolved = false;

      const finish = (result: { error?: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      };

      const handleUrl = async (url: string) => {
        try {
          const urlObj = new URL(url);

          // PKCE flow: code come query param
          const code = urlObj.searchParams.get("code");
          if (code) {
            const { error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              finish({ error: translateAuthError(exchangeError.message) });
            } else {
              finish({});
            }
            return;
          }

          // Implicit flow: token nel fragment
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
                finish({ error: translateAuthError(sessionError.message) });
              } else {
                finish({});
              }
              return;
            }
          }

          // Fallback: il listener onAuthStateChange può aver già popolato
          // la sessione anche se il URL non contiene code (cold start race)
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            finish({});
          } else {
            finish({ error: "Login con Google non completato. Riprova." });
          }
        } catch {
          finish({ error: "Errore durante il login con Google. Riprova." });
        }
      };

      // Timeout 60s — l'utente deve poter riprovare in tempi ragionevoli
      const timer = setTimeout(() => {
        finish({ error: "Timeout: il login non è stato completato." });
      }, 60000);

      try {
        // openAuthSessionAsync chiude il browser automaticamente al redirect
        // finale e restituisce {type: 'success', url: 'vela://auth/callback?code=...'}
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === "success" && result.url) {
          await handleUrl(result.url);
        } else if (result.type === "cancel" || result.type === "dismiss") {
          finish({});
        } else {
          finish({});
        }
      } catch {
        finish({
          error:
            "Impossibile aprire il browser per il login. Verifica che sia installato un browser sul dispositivo.",
        });
      }
    });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signOut,
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
