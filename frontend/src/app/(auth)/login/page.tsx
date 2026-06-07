"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Map Supabase auth error codes to user-facing Italian messages. */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials":
      "Email o password non corretti. Verifica e riprova.",
    "Email not confirmed":
      "Email non ancora verificata. Controlla la tua casella di posta.",
    "Invalid email or password":
      "Email o password non corretti. Verifica e riprova.",
    "User not found":
      "Nessun account trovato con questa email. Verifica o registrati.",
    "confirmation_expired":
      "Il link di conferma è scaduto o non valido. Richiedine uno nuovo.",
  };
  return map[message] ?? message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  const redirect =
    rawRedirect &&
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.includes(":")
      ? rawRedirect
      : "/scanner";
  const justSignedUp = searchParams.get("signup") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Derive initial error from query param (avoids setState-in-useEffect lint error)
  const initialError = useMemo(() => {
    const err = searchParams.get("error");
    return err ? translateAuthError(err) : null;
  }, [searchParams]);
  const [error, setError] = useState<string | null>(initialError);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for rate limiting
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setCooldown(60);
        setAttempts(0);
        setError("Troppi tentativi. Riprova tra 60 secondi.");
      } else {
        setError(translateAuthError(authError.message));
      }
      setLoading(false);
      return;
    }

    setAttempts(0);
    router.push(redirect);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=${redirect}`,
      },
    });

    if (authError) {
      setError(translateAuthError(authError.message));
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError("Inserisci la tua email per reinviare la conferma.");
      return;
    }
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (resendError) {
      setError("Errore nel reinvio. Riprova più tardi.");
    } else {
      setError(null);
      setError("Email di conferma reinviata! Controlla la tua casella.");
    }
  };

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          InvoiceStudio
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">Accedi al tuo account</p>
      </div>

      {justSignedUp && (
        <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-lg px-4 py-3 text-sm text-[#22c55e] mb-4">
          Account creato! Controlla la tua email per verificarlo, poi accedi.
        </div>
      )}

      <div className="mb-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || cooldown > 0}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-lg transition-colors border border-gray-200"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Accedi con Google
        </button>
        <div className="relative mt-6 mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1e2029]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#0f1117] px-2 text-[#6b7280]">O accedi con email</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@studio.it"
            className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-4 py-2.5 text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-4 py-2.5 pr-10 text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e5e7eb] transition-colors p-1 rounded"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-lg px-4 py-3 text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {cooldown > 0
            ? `Riprova tra ${cooldown}s`
            : loading
            ? "Accesso in corso..."
            : "Accedi"}
        </button>

        <div className="flex items-center justify-between text-xs mt-3">
          <Link
            href="/forgot-password"
            className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors"
          >
            Password dimenticata?
          </Link>
          <button
            type="button"
            onClick={handleResendConfirmation}
            className="text-[#6b7280] hover:text-[#e5e7eb] transition-colors bg-transparent border-none cursor-pointer"
          >
            Reinvia email
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-[#6b7280] mt-4">
        <Link href="/forgot-password" className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors">
          Password dimenticata?
        </Link>
      </p>

      <p className="text-center text-sm text-[#6b7280] mt-2">
        Non hai un account?{" "}
        <Link href="/signup" className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors">
          Registrati
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl animate-pulse">
          <div className="text-center mb-8">
            <div className="h-8 w-48 bg-[#1e2029] rounded mx-auto" />
          </div>
          <div className="space-y-4">
            <div className="h-12 bg-[#1e2029] rounded-lg" />
            <div className="h-12 bg-[#1e2029] rounded-lg" />
            <div className="h-12 bg-[#1e2029] rounded-lg" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
