"use client";

import { useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "invoicestudio_referral_banner_dismissed";
const REFERRAL_BASE = "https://invoicestudio.app/ref";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a deterministic 8-char referral code from a seed string */
function generateReferralCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  let h = Math.abs(hash);
  for (let i = 0; i < 8; i++) {
    code += chars[h % chars.length];
    h = Math.floor(h / chars.length);
    if (h < chars.length) h = Math.abs(h * 31 + i);
  }
  return code;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers / non-HTTPS
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ReferralBannerProps {
  /** User identifier to generate a unique referral link */
  userId?: string | null;
}

export function ReferralBanner({ userId }: ReferralBannerProps) {
  // Lazy init from localStorage — avoids setState-in-effect
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const referralCode = generateReferralCode(userId ?? "anonymous");
  const referralUrl = `${REFERRAL_BASE}/${referralCode}`;

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(referralUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralUrl]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
    setVisible(false);
  }, []);

  // Don't render anything if dismissed or not yet hydrated
  if (!visible || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Programma referral"
      className="bg-gradient-to-r from-[#6c63ff]/10 via-[#6c63ff]/5 to-[#0d0e13] border border-[#6c63ff]/15 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
    >
      {/* Icon */}
      <div className="text-2xl shrink-0">🎁</div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#f0f0f2] font-[Georgia,serif]">
          Invita un amico, guadagnate entrambi 1 mese gratis
        </p>
        <p className="text-xs text-[#6b7280] mt-0.5">
          Condividi il tuo link referral: ogni nuovo iscritto attiva{" "}
          <span className="text-[#d1d5db]">1 mese Pro gratuito</span> per entrambi.
        </p>

        {/* Referral link */}
        <div className="mt-2 flex items-center gap-2">
          <code className="bg-[#0a0b0f] border border-[#1e2029] rounded-lg px-3 py-1.5 text-xs text-[#d1d5db] font-mono truncate max-w-[280px]">
            {referralUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              copied
                ? "bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]"
                : "bg-[#6c63ff]/10 border-[#6c63ff]/20 text-[#6c63ff] hover:bg-[#6c63ff]/20"
            }`}
            aria-label={copied ? "Copiato" : "Copia link referral"}
          >
            {copied ? "✓ Copiato" : "📋 Copia"}
          </button>
        </div>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 self-start sm:self-center text-[#6b7280] hover:text-[#e5e7eb] bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-[#111318] transition-colors"
        aria-label="Nascondi banner referral"
      >
        ✕
      </button>
    </div>
  );
}
