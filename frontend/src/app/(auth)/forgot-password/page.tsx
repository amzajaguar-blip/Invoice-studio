"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=/reset-password`,
      }
    );

    if (resetError) {
      setError("Errore nell'invio. Verifica l'email e riprova.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif] mb-2">
            Controlla la tua email
          </h1>
          <p className="text-[#9ca3af] text-sm mb-6">
            Se esiste un account associato a <strong className="text-[#e5e7eb]">{email}</strong>,
            riceverai un link per reimpostare la password.
          </p>
          <Link
            href="/login"
            className="text-[#6c63ff] hover:text-[#8b5cf6] text-sm transition-colors"
          >
            Torna al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
          Password dimenticata
        </h1>
        <p className="text-[#6b7280] text-sm mt-2">
          Inserisci la tua email per ricevere il link di reset.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-[#e5e7eb] mb-1">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@studio.it"
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
          {loading ? "Invio in corso..." : "Invia link di reset"}
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
