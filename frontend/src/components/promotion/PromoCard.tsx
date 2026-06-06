"use client";

import { useState, useCallback } from "react";
import { X, ScanLine } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "invoicestudio_onboarding_promo_dismissed";

// ─── Component ────────────────────────────────────────────────────────────────

interface PromoCardProps {
  /** Whether the promo should be eligible to show (determined server-side) */
  visible: boolean;
}

export function PromoCard({ visible: eligible }: PromoCardProps) {
  // Lazy init: show only if eligible AND not previously dismissed
  const [show, setShow] = useState(() => {
    if (!eligible) return false;
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Benvenuto in InvoiceStudio"
      className="bg-gradient-to-br from-[#6c63ff]/8 via-[#111318] to-[#0d0e13] border border-[#6c63ff]/15 rounded-xl p-6 relative overflow-hidden"
    >
      {/* Subtle decorative blur */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #6c63ff, transparent 70%)" }}
        aria-hidden="true"
      />

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-[#6b7280] hover:text-[#e5e7eb] bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-[#111318] transition-colors z-10"
        aria-label="Nascondi messaggio di benvenuto"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-[1]">
        {/* Heading */}
        <div className="flex items-center gap-2 mb-3">
          <ScanLine className="w-6 h-6 text-[#6c63ff]" />
          <h3 className="text-lg font-bold text-[#f0f0f2] font-[Georgia,serif]">
            Benvenuto! Scansiona la tua prima ricevuta
          </h3>
        </div>

        <p className="text-sm text-[#9ca3af] mb-4">
          InvoiceStudio è pensato per i freelance italiani: tasse automatiche,
          invio email, PDF professionale e monitoraggio pagamenti — tutto in un
          unico posto.
        </p>


        {/* CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <a
            href="/scanner"
            className="inline-flex items-center gap-2 bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors no-underline"
          >
            Scansiona una ricevuta
          </a>
        </div>
      </div>
    </div>
  );
}
