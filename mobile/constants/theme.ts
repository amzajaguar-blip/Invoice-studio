/**
 * Milo Design System - Mobile Theme Tokens
 * Estratti dal globals.css e tokens.ts del frontend per garantire consistenza 1:1.
 */

export const COLORS = {
  // Sfondi
  background: "#0a0b0f",      // Nero profondo principale
  surfacePrimary: "#111318",  // Card / Superfici
  surfaceSecondary: "#1e2029", // Bordi / Superfici secondarie
  surfaceOverlay: "rgba(10, 11, 15, 0.85)", // Overlay per modali/analisi

  // Accent (Milo Premium Indigo)
  accent: "#6c63ff",
  accentHover: "#5b52e0",
  accentGlow: "rgba(108, 99, 255, 0.4)",
  accentSubtle: "rgba(108, 99, 255, 0.1)", // ring/overlay sottile

  // Testi
  textPrimary: "#f0f0f2",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",

  // Stati
  success: "#10b981",         // Verde smeraldo per "Ricevuta Rilevata"
  successBg: "rgba(16, 185, 129, 0.1)",
  successBorder: "rgba(16, 185, 129, 0.25)",
  error: "#f59e0b",           // Arancione/Rosso per alert
  errorBg: "rgba(245, 158, 11, 0.1)",
  errorBorder: "rgba(245, 158, 11, 0.25)",
};

export const SIZES = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusRound: 9999,
};

export const SHADOWS = {
  glow: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  }
};
