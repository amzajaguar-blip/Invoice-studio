"use client";

import { Suspense, useState } from "react";
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
      : "/dashboard";
  const justSignedUp = searchParams.get("signup") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(translateAuthError(authError.message));
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          ✦ InvoiceStudio
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">Accedi al tuo account</p>
      </div>

      {justSignedUp && (
        <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-lg px-4 py-3 text-sm text-[#22c55e] mb-4">
          Account creato! Controlla la tua email per verificarlo, poi accedi.
        </div>
      )}

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
          disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5b52e0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {loading ? "Accesso in corso..." : "Accedi"}
        </button>
      </form>

      <p className="text-center text-sm text-[#6b7280] mt-6">
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
