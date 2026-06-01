/**
 * Milo Design System — Design Tokens (Web)
 * ==========================================
 * Single source of truth for all design decisions.
 * These values MIRROR globals.css CSS variables exactly.
 * Use CSS variables in className/style; use this object
 * in JS logic (e.g., chart colours, dynamic styles).
 *
 * DO NOT add raw colours outside this file.
 */

// ── Palette (HSL base values) ──────────────────────────────────────────────

export const PALETTE = {
  /** Premium Indigo — primary brand accent */
  accent: {
    h: 245,
    s: "100%",
    l: "68%",
    base: "hsl(245, 100%, 68%)",
    hover: "hsl(245, 100%, 60%)",
    hoverDark: "hsl(245, 100%, 74%)",
    light: "hsl(265, 83%, 65%)",
    glow: "hsla(245, 100%, 68%, 0.25)",
    glowDark: "hsla(245, 100%, 68%, 0.2)",
    subtle: "hsla(245, 100%, 68%, 0.08)",
  },

  /** Status — semantic colours */
  status: {
    paid:    { base: "hsl(142, 70%, 38%)", dark: "hsl(142, 70%, 50%)" },
    pending: { base: "hsl(38, 92%, 45%)",  dark: "hsl(38, 92%, 55%)" },
    overdue: { base: "hsl(0, 84%, 55%)",   dark: "hsl(0, 84%, 60%)" },
    draft:   { base: "hsl(220, 10%, 55%)", dark: "hsl(220, 10%, 48%)" },
  },
} as const;

// ── Semantic tokens (resolved) — Light mode ────────────────────────────────

export const LIGHT_TOKENS = {
  background:       "hsl(220, 20%, 98%)",
  foreground:       "hsl(220, 25%, 10%)",
  surfacePrimary:   "hsl(0, 0%, 100%)",
  surfaceSecondary: "hsl(220, 20%, 97%)",
  surfaceTertiary:  "hsl(220, 18%, 94%)",
  borderPrimary:    "hsl(220, 15%, 88%)",
  borderSecondary:  "hsl(220, 12%, 82%)",
  accent:           PALETTE.accent.base,
  accentHover:      PALETTE.accent.hover,
  accentLight:      PALETTE.accent.light,
  accentGlow:       PALETTE.accent.glow,
  textPrimary:      "hsl(220, 25%, 10%)",
  textSecondary:    "hsl(220, 15%, 30%)",
  textMuted:        "hsl(220, 10%, 55%)",
  statusPaid:       PALETTE.status.paid.base,
  statusPending:    PALETTE.status.pending.base,
  statusOverdue:    PALETTE.status.overdue.base,
  statusDraft:      PALETTE.status.draft.base,
  glassBg:          "rgba(255, 255, 255, 0.65)",
  glassBorder:      "rgba(255, 255, 255, 0.8)",
  glassBlur:        "20px",
  glassShadow:      "0 8px 32px rgba(108, 99, 255, 0.08)",
} as const;

// ── Semantic tokens (resolved) — Dark mode ─────────────────────────────────

export const DARK_TOKENS = {
  background:       "hsl(228, 18%, 6%)",
  foreground:       "hsl(220, 15%, 92%)",
  surfacePrimary:   "hsl(228, 16%, 9%)",
  surfaceSecondary: "hsl(228, 14%, 11%)",
  surfaceTertiary:  "hsl(228, 12%, 8%)",
  borderPrimary:    "hsl(228, 14%, 15%)",
  borderSecondary:  "hsl(228, 12%, 13%)",
  accent:           PALETTE.accent.base,
  accentHover:      PALETTE.accent.hoverDark,
  accentLight:      "hsl(265, 83%, 70%)",
  accentGlow:       PALETTE.accent.glowDark,
  textPrimary:      "hsl(220, 20%, 93%)",
  textSecondary:    "hsl(220, 15%, 75%)",
  textMuted:        "hsl(220, 10%, 48%)",
  statusPaid:       PALETTE.status.paid.dark,
  statusPending:    PALETTE.status.pending.dark,
  statusOverdue:    PALETTE.status.overdue.dark,
  statusDraft:      PALETTE.status.draft.dark,
  glassBg:          "rgba(15, 17, 23, 0.75)",
  glassBorder:      "rgba(255, 255, 255, 0.06)",
  glassBlur:        "20px",
  glassShadow:      "0 8px 32px rgba(0, 0, 0, 0.4)",
} as const;

// ── Motion tokens ──────────────────────────────────────────────────────────

export const MOTION = {
  easing: {
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    out:    "cubic-bezier(0, 0, 0.2, 1)",
  },
  duration: {
    micro:  120,   // ms
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

// ── Typography tokens ──────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  fontPrimary: "'Inter', var(--font-geist-sans), system-ui, sans-serif",
  fontMono:    "var(--font-geist-mono), 'Fira Code', monospace",
  scale: {
    xs:   "0.75rem",    // 12px
    sm:   "0.875rem",   // 14px
    base: "1rem",       // 16px
    lg:   "1.125rem",   // 18px
    xl:   "1.25rem",    // 20px
    "2xl":"1.5rem",     // 24px
    "3xl":"1.875rem",   // 30px
    "4xl":"2.25rem",    // 36px
  },
  weight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
    extrabold:800,
  },
} as const;

// ── Spacing / radius tokens ────────────────────────────────────────────────

export const SHAPE = {
  radius: {
    sm:    "8px",
    md:    "12px",
    lg:    "16px",
    xl:    "20px",
    "2xl": "24px",
    full:  "9999px",
  },
} as const;

// ── Convenience re-export (default dark, for legacy consumers) ─────────────

export const tokens = DARK_TOKENS;
