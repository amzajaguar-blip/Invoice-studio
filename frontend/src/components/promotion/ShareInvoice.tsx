"use client";

import { useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SHARE_TEXT_BASE = "Ho creato una fattura professionale con InvoiceStudio 📊 Provalo gratis: ";
const APP_URL = "https://invoicestudio.app";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
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

interface ShareInvoiceProps {
  /** The invoice number, used in the share text (e.g., "FATT-2026-0042") */
  invoiceNumber?: string;
  /** Additional CSS class for the wrapper */
  className?: string;
}

export function ShareInvoice({ invoiceNumber, className = "" }: ShareInvoiceProps) {
  const [copied, setCopied] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const shareText = invoiceNumber
    ? `${SHARE_TEXT_BASE}${APP_URL} (fattura ${invoiceNumber})`
    : `${SHARE_TEXT_BASE}${APP_URL}`;

  const handleShare = useCallback(async () => {
    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: "InvoiceStudio — Fatturazione professionale",
          text: shareText,
          url: APP_URL,
        });
        return;
      } catch (err) {
        // User cancelled — don't fallback
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Other errors — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    const ok = await copyText(shareText);
    if (ok) {
      setCopied(true);
      setTooltipVisible(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setTooltipVisible(false), 2200);
    }
  }, [shareText]);

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleShare}
        onMouseEnter={() => !copied && setTooltipVisible(true)}
        onMouseLeave={() => !copied && setTooltipVisible(false)}
        onFocus={() => !copied && setTooltipVisible(true)}
        onBlur={() => !copied && setTooltipVisible(false)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#6b7280] hover:text-[#6c63ff] bg-transparent hover:bg-[#6c63ff]/10 border border-transparent hover:border-[#6c63ff]/20 cursor-pointer transition-all"
        aria-label={
          copied
            ? "Testo copiato negli appunti"
            : "Condividi fattura"
        }
      >
        {copied ? (
          <>
            <span className="text-[#22c55e] text-sm">✓</span>
            <span className="text-[#22c55e]">Copiato</span>
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Condividi</span>
          </>
        )}
      </button>

      {/* Tooltip */}
      {tooltipVisible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1a1c23] border border-[#2a2d3a] rounded-lg text-xs text-[#d1d5db] whitespace-nowrap shadow-lg z-50 pointer-events-none"
        >
          {copied ? "✓ Link copiato!" : "Condividi su WhatsApp, email…"}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#2a2d3a]" />
        </div>
      )}
    </div>
  );
}
