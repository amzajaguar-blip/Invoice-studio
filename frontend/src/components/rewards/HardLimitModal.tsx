"use client";

import type { UserQuota } from "@/types/rewards";

/**
 * Hard limit modal — shown when the user tries to create an invoice
 * but has exhausted both the plan limit and rewarded credits.
 *
 * Offers two paths:
 * 1. Watch a rewarded ad (if credits still available)
 * 2. Upgrade to Pro
 *
 * Italian copy: trasparente, empatico, professionale.
 */
export function HardLimitModal({
  quota,
  onClose,
  onWatchAd,
  onUpgrade,
}: {
  quota: UserQuota | null;
  onClose: () => void;
  onWatchAd?: () => void;
  onUpgrade?: () => void;
}) {
  if (!quota) return null;

  const canWatchAd = quota.showRewardedAdOption;
  const totalUsed = quota.currentMonthInvoices;
  const totalCapacity = quota.planLimit + quota.rewardedCredits;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1117] border border-[#1e2029] rounded-2xl p-8 w-[min(480px,95vw)] z-[111] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Limite fatture raggiunto"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
            Limite fatture raggiunto
          </h2>
          <p className="text-sm text-[#6b7280] mt-2">
            Hai creato{" "}
            <span className="text-[#f0f0f2] font-medium">{totalUsed}</span>{" "}
            fattur{totalUsed === 1 ? "a" : "e"} su{" "}
            <span className="text-[#f0f0f2] font-medium">{totalCapacity}</span>{" "}
            disponibil{totalCapacity === 1 ? "e" : "i"} questo mese.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {canWatchAd && onWatchAd && (
            <button
              onClick={onWatchAd}
              className="w-full bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-5 py-3.5 rounded-xl text-sm border-none cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <span>🎬</span>
              <span>Sblocca 1 fattura extra gratis</span>
              <span className="text-[#8b8bff] text-xs">
                (guarda un video)
              </span>
            </button>
          )}

          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="w-full bg-[#111318] hover:bg-[#1a1d25] text-[#f0f0f2] font-medium px-5 py-3.5 rounded-xl text-sm border border-[#2a2d3a] cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>Passa a Pro — 19€/mese</span>
              <span className="text-[#6b7280] text-xs">(fatture illimitate)</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-[#6b7280]">
            I video sono visibili solo a te. I PDF e i link di pagamento che
            invii ai clienti rimangono{" "}
            <span className="text-[#22c55e]">100% professionali</span>.
          </p>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-transparent border-none text-[#6b7280] hover:text-[#e5e7eb] text-lg cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg"
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>
    </>
  );
}
