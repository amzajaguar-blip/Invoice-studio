"use client";
import { useEffect } from "react";

export default function ConfirmEmailPage() {
  useEffect(() => {
    // Tenta di aprire l'app automaticamente dopo 1.5 secondi
    const timer = setTimeout(() => {
      window.location.href = "invoicestudio://";
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-[#111318] p-8 rounded-2xl border border-[#1e2029] max-w-md w-full shadow-2xl">
        <div className="text-5xl mb-4 text-[#6c63ff]">✅</div>
        <h1 className="text-2xl font-bold text-[#f0f0f2] mb-2 font-serif">
          Email Confermata!
        </h1>
        <p className="text-[#9ca3af] mb-8">
          Il tuo account Invoice Studio è ora attivo e pronto all&apos;uso.
        </p>

        <div className="animate-pulse text-sm text-[#6c63ff] mb-6">
          Tentativo di apertura dell&apos;app in corso...
        </div>

        <button
          onClick={() => { window.location.href = "invoicestudio://"; }}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52d5] transition-colors text-white font-bold py-3 px-6 rounded-xl"
        >
          Apri Invoice Studio
        </button>

        <p className="text-[#6b7280] text-xs mt-6">
          Se sei da computer, puoi chiudere questa pagina e aprire l&apos;app sul tuo telefono.
        </p>
      </div>
    </div>
  );
}
