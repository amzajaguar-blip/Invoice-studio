"use client";

/**
 * KPICard — Premium Dashboard metric card
 * =========================================
 * Fully token-driven: no raw hex values.
 * Supports an optional href for navigation.
 * Displays a micro-hover lift via CSS class card-premium.
 */

interface KPICardProps {
  label: string;
  value: string;
  sub: string;
  /** Semantic meaning drives the colour — uses CSS status tokens */
  accent?: "default" | "paid" | "pending" | "overdue" | "draft";
  /** Raw CSS colour override (use sparingly — prefer accent semantic) */
  accentColor?: string;
  icon: string;
  href?: string;
  id?: string;
}

const ACCENT_CLASSES: Record<NonNullable<KPICardProps["accent"]>, string> = {
  default: "text-[var(--accent)]",
  paid:    "text-[var(--status-paid)]",
  pending: "text-[var(--status-pending)]",
  overdue: "text-[var(--status-overdue)]",
  draft:   "text-[var(--text-muted)]",
};

export function KPICard({
  label,
  value,
  sub,
  accent = "default",
  accentColor,
  icon,
  href,
  id,
}: KPICardProps) {
  const valueClass = ACCENT_CLASSES[accent];

  const card = (
    <div
      id={id}
      className="card-premium p-5 group animate-slide-up"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <span
          className="text-lg w-9 h-9 flex items-center justify-center rounded-lg
                     bg-[var(--surface-secondary)] group-hover:bg-[var(--surface-tertiary)]
                     transition-colors duration-[var(--duration-fast)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      {/* Value */}
      <div
        className={`text-2xl font-bold tracking-tight leading-none ${valueClass}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </div>

      {/* Sub-label */}
      <div className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
        {sub}
      </div>

      {/* Hover accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl opacity-0
                   group-hover:opacity-100 transition-opacity duration-[var(--duration-fast)]
                   bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)]"
        aria-hidden="true"
      />
    </div>
  );

  if (href) {
    return (
      <a href={href} className="no-underline block relative overflow-hidden" tabIndex={0}>
        {card}
      </a>
    );
  }

  return <div className="relative overflow-hidden">{card}</div>;
}
