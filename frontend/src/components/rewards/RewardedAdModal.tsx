"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRewardedAd } from "@/hooks/useRewards";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AdState = "loading" | "ready" | "playing" | "completed" | "error" | "claiming" | "claimed";

interface RewardedAdModalProps {
  orgId?: string;
  onClose: () => void;
  onRewardClaimed?: (quota: unknown) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Rewarded Ad Modal — gestisce l'intero flusso:
 * 1. Caricamento ad
 * 2. Riproduzione
 * 3. Verifica server-side
 * 4. Conferma ricompensa
 * 5. Gestione errori
 *
 * Design: scuro elegante, coerente con InvoiceStudio.
 * Copy ITA: umano, empatico, trasparente.
 */
export function RewardedAdModal({
  orgId,
  onClose,
  onRewardClaimed,
}: RewardedAdModalProps) {
  const [adState, setAdState] = useState<AdState>("loading");
  const [progress, setProgress] = useState(0);
  const { claimReward, claimError } = useRewardedAd(orgId);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Simulated ad playback ────────────────────────────────────────────────

  const startAdPlayback = useCallback(() => {
    setAdState("playing");
    setProgress(0);

    // Simulate ad loading → playback → completion
    // In production, this would use the Google AdMob SDK or a rewarded ad network
    const duration = 5000; // 5 seconds for mock; real ads are 15-30s
    const interval = 100; // update every 100ms
    const steps = duration / interval;
    let step = 0;

    timerRef.current = setInterval(() => {
      step++;
      setProgress(Math.min((step / steps) * 100, 100));

      if (step >= steps) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setAdState("completed");
      }
    }, interval);
  }, []);

  // ─── Start on mount ───────────────────────────────────────────────────────

  useEffect(() => {
    // Simulate SDK loading delay
    const loadTimer = setTimeout(() => {
      setAdState("ready");
      startAdPlayback();
    }, 800);

    return () => {
      clearTimeout(loadTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAdPlayback]);

  // ─── Claim reward when ad completes ───────────────────────────────────────

  useEffect(() => {
    if (adState !== "completed") return;

    const claim = async () => {
      setAdState("claiming");
      const result = await claimReward();
      if (result) {
        setAdState("claimed");
        onRewardClaimed?.(result);
      } else {
        setAdState("error");
      }
    };

    claim();
  }, [adState, claimReward, onRewardClaimed]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Render states ────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (adState) {
      case "loading":
        return <LoadingState />;
      case "ready":
        return <ReadyState onStart={startAdPlayback} />;
      case "playing":
        return <PlayingState progress={progress} />;
      case "claiming":
        return <ClaimingState />;
      case "claimed":
        return <ClaimedState onClose={onClose} />;
      case "error":
        return <ErrorState error={claimError} onRetry={startAdPlayback} onClose={onClose} />;
      default:
        return <LoadingState />;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[120]"
        onClick={adState === "claimed" ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f1117] border border-[#1e2029] rounded-2xl p-6 w-[min(400px,92vw)] z-[121] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Video sponsorizzato"
      >
        {renderContent()}
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-12 h-12 rounded-full border-2 border-[#6c63ff] border-t-transparent animate-spin" />
      <div className="text-center">
        <p className="text-sm text-[#e5e7eb] font-medium">Caricamento video...</p>
        <p className="text-xs text-[#6b7280] mt-1">
          Stiamo preparando il tuo video sponsorizzato
        </p>
      </div>
    </div>
  );
}

function ReadyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="text-3xl">🎬</div>
      <div className="text-center">
        <p className="text-sm text-[#e5e7eb] font-medium">Video pronto</p>
        <p className="text-xs text-[#6b7280] mt-1">
          Guarda un breve video per sbloccare 1 fattura extra
        </p>
      </div>
      <button
        onClick={onStart}
        className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-6 py-2.5 rounded-xl text-sm border-none cursor-pointer transition-colors"
      >
        ▶️ Guarda ora
      </button>
    </div>
  );
}

function PlayingState({ progress }: { progress: number }) {
  const secondsLeft = Math.ceil((100 - progress) / 20);

  return (
    <div className="flex flex-col gap-4">
      {/* Ad container */}
      <div
        className="bg-[#111318] border border-[#1e2029] rounded-xl aspect-video flex items-center justify-center relative overflow-hidden"
      >
        {/* Simulated ad placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#0f1117] to-[#1a1a2e]" />
        <div className="relative z-10 text-center">
          <p className="text-4xl mb-2">📢</p>
          <p className="text-sm text-[#6b7280]">Video sponsorizzato</p>
          <p className="text-xs text-[#6b7280]/60 mt-1">
            {secondsLeft}s rimanenti
          </p>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2029]">
          <div
            className="h-full bg-[#6c63ff] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-center text-xs text-[#6b7280]">
        La pubblicità è visibile solo a te. I tuoi clienti non la vedranno mai.
      </p>
    </div>
  );
}

function ClaimingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-10 h-10 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
      <div className="text-center">
        <p className="text-sm text-[#e5e7eb] font-medium">Verifica in corso...</p>
        <p className="text-xs text-[#6b7280] mt-1">
          Stiamo verificando il completamento del video
        </p>
      </div>
    </div>
  );
}

function ClaimedState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-4xl animate-bounce">🎉</div>
      <div className="text-center">
        <p className="text-base font-semibold text-[#22c55e]">
          Fattura sbloccata!
        </p>
        <p className="text-sm text-[#e5e7eb] mt-1">
          Hai guadagnato 1 fattura extra
        </p>
        <p className="text-xs text-[#6b7280] mt-2">
          Puoi crearla subito. Buon lavoro 🚀
        </p>
      </div>
      <button
        onClick={onClose}
        className="bg-[#22c55e] hover:bg-[#1ea34e] text-white font-medium px-6 py-2.5 rounded-xl text-sm border-none cursor-pointer transition-colors mt-2"
      >
        ✦ Crea fattura
      </button>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-3xl">😔</div>
      <div className="text-center">
        <p className="text-sm text-[#e5e7eb] font-medium">Qualcosa è andato storto</p>
        <p className="text-xs text-[#ef4444] mt-1">
          {error || "Impossibile verificare il completamento del video"}
        </p>
        <p className="text-xs text-[#6b7280] mt-2">
          Nessun problema: riprova o passa direttamente al piano Pro.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-4 py-2 rounded-xl text-sm border-none cursor-pointer transition-colors"
        >
          🔄 Riprova
        </button>
        <button
          onClick={onClose}
          className="bg-transparent hover:bg-[#1e2029] text-[#6b7280] hover:text-[#e5e7eb] font-medium px-4 py-2 rounded-xl text-sm border border-[#1e2029] cursor-pointer transition-colors"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
