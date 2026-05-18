"use client";

import { useState } from "react";

const STORAGE_KEY = "invoicestudio_cookie_consent";
const PRIVACY_URL = "/privacy";

export function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informativa cookie"
      className="fixed bottom-0 inset-x-0 z-[200] bg-[#0d0e13] border-t border-[#1e2029] px-4 py-3 md:px-6 md:py-4 shadow-2xl"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-[#d1d5db] leading-relaxed flex-1">
          Questo sito utilizza cookie tecnici essenziali per il funzionamento.
          Continuando accetti l&apos;uso.
        </p>
        <div className="flex gap-2 shrink-0">
          <a
            href={PRIVACY_URL}
            className="px-4 py-2 rounded-lg text-sm text-[#9ca3af] hover:text-[#e5e7eb] bg-transparent border border-[#1e2029] hover:bg-[#111318] transition-colors no-underline"
          >
            Privacy Policy
          </a>
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#6c63ff] hover:bg-[#5b52e0] border-none cursor-pointer transition-colors"
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
}
