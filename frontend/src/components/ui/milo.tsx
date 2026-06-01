"use client";

/**
 * Milo Design System — Web Primitive Components
 * ===============================================
 * MiloButton  — primary, secondary, ghost, destructive variants
 * MiloCard    — premium card with optional glass and hover-lift
 * MiloBadge   — status / label badge driven by tokens
 * MiloDivider — subtle section separator
 * MiloSpinner — accessible loading indicator
 *
 * Rules:
 *  - NO raw hex values — all colours come from CSS variables
 *  - NO Tailwind arbitrary values for colours (use [var(--token)] syntax)
 *  - Supports reduced-motion via CSS media query
 */

import React from "react";

// ── TYPES ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize    = "sm" | "md" | "lg";
type BadgeVariant  = "default" | "paid" | "pending" | "overdue" | "draft" | "pro";

// ── MILO BUTTON ────────────────────────────────────────────────────────────

interface MiloButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl " +
  "transition-all cursor-pointer border-none relative overflow-hidden " +
  "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none " +
  "active:scale-[0.97]";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[0_4px_20px_var(--accent-glow)] " +
    "hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--accent-glow)]",
  secondary:
    "bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] " +
    "hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 " +
    "hover:bg-[var(--surface-tertiary)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] " +
    "hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]",
  destructive:
    "bg-[var(--status-overdue)] text-white " +
    "hover:opacity-90 hover:-translate-y-0.5",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8  px-3  text-xs  gap-1.5",
  md: "h-10 px-5  text-sm",
  lg: "h-12 px-6  text-base",
};

export function MiloButton({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  children,
  className = "",
  ...props
}: MiloButtonProps) {
  const classes = [
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={loading || props.disabled} {...props}>
      {/* Shimmer overlay on hover for primary */}
      {variant === "primary" && (
        <span
          className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent
                     opacity-0 hover:opacity-100 transition-opacity duration-[var(--duration-micro)]"
          aria-hidden="true"
        />
      )}

      {loading ? (
        <MiloSpinner size={size === "lg" ? 20 : 16} />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <span className="shrink-0" aria-hidden="true">{icon}</span>
          )}
          {children}
          {icon && iconPosition === "right" && (
            <span className="shrink-0" aria-hidden="true">{icon}</span>
          )}
        </>
      )}
    </button>
  );
}

// ── MILO CARD ──────────────────────────────────────────────────────────────

interface MiloCardProps {
  children: React.ReactNode;
  glass?: boolean;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  id?: string;
  as?: "div" | "section" | "article";
}

const CARD_PADDING: Record<NonNullable<MiloCardProps["padding"]>, string> = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-7",
};

export function MiloCard({
  children,
  glass = false,
  hover = true,
  padding = "md",
  className = "",
  id,
  as: Tag = "div",
}: MiloCardProps) {
  const base = glass ? "glass-card rounded-2xl" : "card-premium";
  const hoverClass = hover ? "" : "[&]:hover:transform-none [&]:hover:box-shadow-none";

  return (
    <Tag
      id={id}
      className={`${base} ${CARD_PADDING[padding]} ${hoverClass} ${className}`}
    >
      {children}
    </Tag>
  );
}

// ── MILO BADGE ────────────────────────────────────────────────────────────

interface MiloBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  default: "status-badge status-draft",
  paid:    "status-badge status-paid",
  pending: "status-badge status-pending",
  overdue: "status-badge status-overdue",
  draft:   "status-badge status-draft",
  pro:
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold " +
    "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]",
};

export function MiloBadge({
  variant = "default",
  children,
  className = "",
}: MiloBadgeProps) {
  return (
    <span className={`${BADGE_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ── MILO DIVIDER ──────────────────────────────────────────────────────────

interface MiloDividerProps {
  label?: string;
  className?: string;
}

export function MiloDivider({ label, className = "" }: MiloDividerProps) {
  if (!label) {
    return (
      <hr className={`border-[var(--border-primary)] ${className}`} aria-hidden="true" />
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} role="separator">
      <div className="flex-1 h-px bg-[var(--border-primary)]" />
      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--border-primary)]" />
    </div>
  );
}

// ── MILO SPINNER ──────────────────────────────────────────────────────────

interface MiloSpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export function MiloSpinner({
  size = 20,
  color,
  className = "",
}: MiloSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{
        animation: "spin-smooth 0.75s linear infinite",
        color: color || "currentColor",
      }}
      aria-label="Caricamento…"
      role="status"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="10"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── MILO EMPTY STATE ──────────────────────────────────────────────────────

interface MiloEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function MiloEmptyState({
  icon = "📄",
  title,
  description,
  action,
  className = "",
}: MiloEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}
    >
      <div
        className="w-16 h-16 flex items-center justify-center rounded-2xl text-3xl mb-4
                   bg-[var(--surface-secondary)] border border-[var(--border-primary)]
                   animate-float"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
