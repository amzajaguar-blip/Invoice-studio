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

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          InvoiceStudio
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">Crea il tuo account gratuito</p>
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
