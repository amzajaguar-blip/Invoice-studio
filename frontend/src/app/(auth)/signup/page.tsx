"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function translateSignupError(message: string): string {
  const map: Record<string, string> = {
    "User already registered":
      "Esiste già un account con questa email. Prova ad accedere.",
    "Password should be at least 10 characters":
      "La password deve contenere almeno 10 caratteri.",
    "Password should be at least 6 characters":
      "La password deve contenere almeno 6 caratteri.",
    "Unable to validate email address: invalid format":
      "Formato email non valido. Verifica e riprova.",
    "Unable to validate email address":
      "Email non valida. Controlla e riprova.",
    "Signup requires a valid password":
      "Inserisci una password valida.",
  };
  return map[message] ?? message;
}

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 10) {
      setError("La password deve essere di almeno 10 caratteri.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=/scanner`,
      },
    });

    if (authError) {
      setError(translateSignupError(authError.message));
      setLoading(false);
      return;
    }

    // Show confirmation message instead of redirecting
    router.push("/login?signup=success");
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=/scanner`,
      },
    });

    if (authError) {
      setError(translateSignupError(authError.message));
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          InvoiceStudio
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">Crea il tuo account gratuito</p>
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-lg transition-colors border border-gray-200"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Registrati con Google
        </button>
        <div className="relative mt-6 mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1e2029]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#0f1117] px-2 text-[#6b7280]">O registrati con email</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Nome completo
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marco Bianchi"
            className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-4 py-2.5 text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
          />
        </div>

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
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Almeno 10 caratteri"
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Conferma Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ripeti la password"
            className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-4 py-2.5 text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
          />
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2">
          <input
            id="terms"
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#6c63ff] cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs text-[#6b7280] leading-relaxed">
            Accetto i{" "}
            <Link href="/terms" target="_blank" className="text-[#6c63ff] hover:text-[#8b5cf6] underline">
              Termini di Servizio
            </Link>{" "}
            e la{" "}
            <Link href="/privacy" target="_blank" className="text-[#6c63ff] hover:text-[#8b5cf6] underline">
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        {error && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-lg px-4 py-3 text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !termsAccepted}
          className="w-full bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {loading ? "Creazione account..." : "Crea account"}
        </button>
      </form>

      <p className="text-center text-sm text-[#6b7280] mt-6">
        Hai già un account?{" "}
        <Link href="/login" className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors">
          Accedi
        </Link>
      </p>
    </div>
  );
}
