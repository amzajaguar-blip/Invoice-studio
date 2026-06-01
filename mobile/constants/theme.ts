/**
 * Milo Design System — Mobile Theme Tokens
 * ==========================================
 * Mirrors frontend/src/styles/tokens.ts for React Native.
 * Always access via useTheme() hook — never import DARK/LIGHT directly
 * into components, so dark-mode toggling works without tree re-renders.
 *
 * KEEP IN SYNC with:
 *   frontend/src/styles/tokens.ts
 *   frontend/src/app/globals.css
 */

import { Appearance } from "react-native";

// ── Colour palettes ────────────────────────────────────────────────────────

export const DARK_COLORS = {
  // Backgrounds
  background:       "#0c0d13",
  surfacePrimary:   "#111318",
  surfaceSecondary: "#1e2029",
  surfaceTertiary:  "#0f1016",
  surfaceOverlay:   "rgba(10, 11, 15, 0.85)",

  // Borders
  borderPrimary:   "#1e2029",
  borderSecondary: "#161820",

  // Accent — Milo Premium Indigo (hsl 245 100% 68%)
  accent:      "#6c63ff",
  accentHover: "#7c74ff",
  accentGlow:  "rgba(108, 99, 255, 0.35)",
  accentSubtle:"rgba(108, 99, 255, 0.1)",

  // Typography
  textPrimary:   "#f0f0f2",
  textSecondary: "#8e95a2",
  textMuted:     "#555b6a",

  // Status
  statusPaid:    "#22c55e",
  statusPending: "#f59e0b",
  statusOverdue: "#ef4444",
  statusDraft:   "#6b7280",

  // Status backgrounds (12% alpha)
  statusPaidBg:    "rgba(34,197,94,0.12)",
  statusPendingBg: "rgba(245,158,11,0.12)",
  statusOverdueBg: "rgba(239,68,68,0.12)",
  statusDraftBg:   "rgba(107,114,128,0.12)",

  // Semantic helpers
  error:       "#ef4444",
  errorBg:     "rgba(239,68,68,0.1)",
  errorBorder: "rgba(239,68,68,0.25)",
  success:     "#22c55e",
  successBg:   "rgba(34,197,94,0.1)",
  successBorder:"rgba(34,197,94,0.25)",
} as const;

export const LIGHT_COLORS = {
  // Backgrounds
  background:       "#f5f6fa",
  surfacePrimary:   "#ffffff",
  surfaceSecondary: "#f0f1f7",
  surfaceTertiary:  "#e8eaf3",
  surfaceOverlay:   "rgba(245,246,250,0.92)",

  // Borders
  borderPrimary:   "#dde1ed",
  borderSecondary: "#c8cedd",

  // Accent — same brand colour, both modes
  accent:      "#6c63ff",
  accentHover: "#5b52e0",
  accentGlow:  "rgba(108, 99, 255, 0.22)",
  accentSubtle:"rgba(108, 99, 255, 0.08)",

  // Typography
  textPrimary:   "#181a27",
  textSecondary: "#4b5270",
  textMuted:     "#8890aa",

  // Status
  statusPaid:    "#16a34a",
  statusPending: "#d97706",
  statusOverdue: "#dc2626",
  statusDraft:   "#6b7280",

  // Status backgrounds
  statusPaidBg:    "rgba(22,163,74,0.1)",
  statusPendingBg: "rgba(217,119,6,0.1)",
  statusOverdueBg: "rgba(220,38,38,0.1)",
  statusDraftBg:   "rgba(107,114,128,0.1)",

  // Semantic helpers
  error:        "#dc2626",
  errorBg:      "rgba(220,38,38,0.08)",
  errorBorder:  "rgba(220,38,38,0.2)",
  success:      "#16a34a",
  successBg:    "rgba(22,163,74,0.08)",
  successBorder:"rgba(22,163,74,0.2)",
} as const;

// ── Aliases (legacy support) ───────────────────────────────────────────────
// These used to be the only export; kept for backward compatibility.
// Components should migrate to useTheme() for dynamic values.

export const COLORS = DARK_COLORS;

// ── Sizing & radius ────────────────────────────────────────────────────────

export const SIZES = {
  radiusSm:    8,
  radiusMd:    12,
  radiusLg:    16,
  radiusXl:    20,
  radiusRound: 9999,
} as const;

// ── Shadow presets ─────────────────────────────────────────────────────────

export const makeShadows = (colors: { accent: string; [key: string]: string }) => ({
  glow: {
    shadowColor:   colors.accent,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  12,
    elevation:     8,
  },
  card: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius:  8,
    elevation:     4,
  },
  subtle: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius:  4,
    elevation:     2,
  },
});

export const SHADOWS = makeShadows(DARK_COLORS);

// ── Motion (mirrors frontend MOTION object) ────────────────────────────────

export const MOTION = {
  duration: {
    micro:  120,
    fast:   200,
    normal: 350,
    slow:   600,
  },
  confetti: {
    particles: 55,
    colors: [
      "#6c63ff", "#8b5cf6", "#a78bfa",
      "#34d399", "#60a5fa", "#f472b6",
      "#fbbf24", "#f87171",
    ],
  },
} as const;

// ── Helper: resolve current system theme ──────────────────────────────────

export function getSystemColorScheme(): "dark" | "light" {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}

// ── Resolve a colour set by mode ──────────────────────────────────────────

export function resolveColors(mode: "dark" | "light") {
  return mode === "light" ? LIGHT_COLORS : DARK_COLORS;
}
