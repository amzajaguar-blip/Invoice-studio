"use client";

/**
 * useSuccessAnimation — P1.1 Micro-Interaction Hook
 * ---------------------------------------------------
 * Confetti burst on invoice paid, pulse on save,
 * skeleton state helpers, and reduced-motion support.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  duration: number;
}

interface UseSuccessAnimationReturn {
  triggerConfetti: () => void;
  triggerPulse: (elementId: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  ConfettiOverlay: () => React.JSX.Element | null;
}

const CONFETTI_COLORS = [
  "#6c63ff", "#8b5cf6", "#a78bfa",
  "#34d399", "#60a5fa", "#f472b6",
  "#fbbf24", "#f87171",
];

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSuccessAnimation(): UseSuccessAnimationReturn {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const counterRef = useRef(0);

  const triggerConfetti = useCallback(() => {
    if (getPrefersReducedMotion()) return;

    const count = 55;
    const newParticles: ConfettiParticle[] = Array.from({ length: count }, (_, i) => ({
      id: ++counterRef.current * 1000 + i,
      x: 30 + Math.random() * 40, // center cluster %
      y: -5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 1,
      duration: 1200 + Math.random() * 800,
    }));

    setParticles((prev) => [...prev, ...newParticles]);

    // Clean up after longest animation
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.find((np) => np.id === p.id))
      );
    }, 2500);
  }, []);

  const triggerPulse = useCallback((elementId: string) => {
    if (getPrefersReducedMotion()) return;
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add("animate-pulse-glow");
    setTimeout(() => el.classList.remove("animate-pulse-glow"), 600);
  }, []);

  const ConfettiOverlay = useCallback((): React.JSX.Element | null => {
    if (particles.length === 0) return null;
    return (
      <div
        className="success-overlay"
        aria-hidden="true"
        role="presentation"
      >
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x + (Math.random() - 0.5) * 60}%`,
              top: `${p.y}%`,
              width: `${8 * p.scale}px`,
              height: `${12 * p.scale}px`,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              transform: `rotate(${p.rotation}deg)`,
              animation: `confetti-fall ${p.duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
              opacity: 1,
            }}
          />
        ))}
      </div>
    );
  }, [particles]);

  return { triggerConfetti, triggerPulse, isLoading, setIsLoading, ConfettiOverlay };
}

/**
 * SkeletonBlock — reusable loading placeholder
 */
export function SkeletonBlock({
  width = "100%",
  height = "20px",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonCard — card-shaped skeleton for invoice lists, etc.
 */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card-premium p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock width="40%" height="18px" />
        <SkeletonBlock width="80px" height="24px" className="rounded-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={`${60 + Math.random() * 35}%`}
          height="14px"
        />
      ))}
      <div className="flex items-center gap-2 pt-1">
        <SkeletonBlock width="90px" height="32px" className="rounded-lg" />
        <SkeletonBlock width="70px" height="32px" className="rounded-lg" />
      </div>
    </div>
  );
}
