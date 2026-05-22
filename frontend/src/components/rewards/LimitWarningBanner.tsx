"use client";

import type { UserQuota } from "@/types/rewards";

/**
 * Soft limit warning banner — shown when the user is near their plan limit.
 * Appears at 4/5 invoices (or 1 remaining before the combined limit).
 *
 * Italian copy: empatico, non invasivo, orientato alla crescita.
 */
export function LimitWarningBanner({
  quota,
  onWatchAd,
  onUpgrade,
}: {
  quota: UserQuota;
  onWatchAd?: () => void;
  onUpgrade?: () => void;
}) {
  if (!quota || quota.unlimited) return null;

  const remaining = quota.remainingBase + quota.rewardedCredits;
  // Show only when 0 or 1 invoice remains before the hard limit
  if (remaining > 1) return null;

  const isLastOne = remaining === 0;
  const message = isLastOne
    ? "Hai raggiunto il limite di fatture gratuite questo mese."
    : "Ti resta 1 fattura gratuita questo mese.";

  return (
    <div className="bg-[#1a1a2e] border border-[#6c63ff]/30 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm text-[#e5e7eb] font-medium">{message}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {quota.showRewardedAdOption
              ? "Guarda un video sponsorizzato per sbloccare una fattura extra — gratis."
              : "Passa al piano Pro per fatture illimitate e funzionalità avanzate."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {quota.showRewardedAdOption && onWatchAd && (
          <button
            onClick={onWatchAd}
            className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white text-xs font-medium px-4 py-2 rounded-lg border-none cursor-pointer transition-colors whitespace-nowrap"
          >
            🎬 Sblocca gratis
          </button>
        )}
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="bg-transparent hover:bg-[#1e2029] text-[#6c63ff] text-xs font-medium px-4 py-2 rounded-lg border border-[#6c63ff]/30 cursor-pointer transition-colors whitespace-nowrap"
          >
            Passa a Pro →
          </button>
        )}
      </div>
    </div>
  );
}
