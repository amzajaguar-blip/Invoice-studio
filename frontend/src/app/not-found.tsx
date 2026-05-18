import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pagina non trovata — InvoiceStudio",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b0f] px-6 text-center">
      {/* 404 visual */}
      <p className="font-[family-name:Georgia,serif] text-8xl font-bold text-[#6c63ff]">
        404
      </p>

      <h1 className="mt-6 font-[family-name:Georgia,serif] text-2xl font-bold text-[#f0f0f2] sm:text-3xl">
        Pagina non trovata
      </h1>

      <p className="mt-3 max-w-md text-base leading-relaxed text-[#6b7280]">
        La pagina che stai cercando non esiste o è stata spostata. Controlla
        l&apos;indirizzo oppure torna alla home.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="rounded-xl bg-[#6c63ff] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6c63ff]/25 transition-all hover:scale-105 hover:bg-[#8b5cf6] active:scale-[0.98]"
        >
          Torna alla home
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[#1e2029] bg-[#0f1117] px-6 py-3 text-sm font-medium text-[#e5e7eb] transition-all hover:border-[#6c63ff]/50 hover:text-[#f0f0f2]"
        >
          Accedi
        </Link>
      </div>
    </div>
  );
}
