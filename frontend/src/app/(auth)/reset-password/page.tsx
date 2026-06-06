"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Verify that the user arrived here via the recovery link (session must exist)
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setSessionChecked(true);
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
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
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to scanner after 2 seconds
    setTimeout(() => {
      router.push("/scanner");
      router.refresh();
    }, 2000);
  };

  // Loading state while checking session
  if (!sessionChecked) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="animate-pulse text-[#6b7280]">Verifica in corso...</div>
        </div>
      </div>
    );
  }

  // No session = user didn't arrive via recovery link
  if (!hasSession) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-2">
            Link non valido
          </h1>
          <p className="text-[#9ca3af] text-sm mb-6">
            Il link di reset è scaduto o non è valido. Richiedine uno nuovo.
          </p>
          <Link
            href="/forgot-password"
            className="text-[#6c63ff] hover:text-[#8b5cf6] text-sm transition-colors"
          >
            Richiedi nuovo link
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-2">
            Password aggiornata
          </h1>
          <p className="text-[#9ca3af] text-sm">
            Reindirizzamento in corso...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          Nuova password
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">
          Scegli una nuova password per il tuo account.
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Nuova password
          </label>
          <div className="relative">
            <input
              id="new-password"
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
          <label htmlFor="confirm-new-password" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Conferma nuova password
          </label>
          <input
            id="confirm-new-password"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ripeti la password"
            className="w-full bg-[#111318] border border-[#1e2029] rounded-lg px-4 py-2.5 text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] focus:ring-1 focus:ring-[#6c63ff] transition-colors"
          />
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
          {loading ? "Aggiornamento..." : "Aggiorna password"}
        </button>
      </form>

      <p className="text-center text-sm text-[#6b7280] mt-6">
        <Link href="/login" className="text-[#6c63ff] hover:text-[#8b5cf6] transition-colors">
          Torna al login
        </Link>
      </p>
    </div>
  );
}
