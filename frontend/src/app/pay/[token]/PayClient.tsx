"use client";

import { useState } from "react";

interface PayClientProps {
  token: string;
  invoiceNumber: string;
}

export function PayClient({ token, invoiceNumber }: PayClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pay/${token}`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Errore durante la creazione del pagamento");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (json.data?.stripeUrl) {
        window.location.href = json.data.stripeUrl;
      } else {
        setError("URL di pagamento non disponibile");
        setLoading(false);
      }
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-3.5 px-6 bg-[#6c63ff] hover:bg-[#5a52e8] disabled:bg-[#6c63ff]/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#6c63ff]/20 text-base"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Preparando il pagamento...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Paga {invoiceNumber} con Carta
          </span>
        )}
      </button>

      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-3 text-sm text-[#ef4444] text-center" role="alert">
          {error}
        </div>
      )}

      <p className="text-center text-xs text-[#6b7280]">
        Verrai reindirizzato alla pagina di pagamento sicuro di Stripe
      </p>
    </div>
  );
}
