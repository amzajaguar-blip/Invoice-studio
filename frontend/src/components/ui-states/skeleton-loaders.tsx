// ─── Skeleton loaders — reusable loading placeholders ───

import React from "react";

interface SkeletonBlockProps {
  className?: string;
  /** Width in any CSS unit. Default: 100% */
  width?: string;
  /** Height in any CSS unit. Default: 1rem */
  height?: string;
  /** Border radius. Default: 0.375rem */
  rounded?: string;
  /** Pulse animation enabled. Default: true */
  animate?: boolean;
}

export function SkeletonBlock({
  className = "",
  width = "100%",
  height = "1rem",
  rounded = "0.375rem",
  animate = true,
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-muted ${animate ? "animate-pulse" : ""} ${className}`}
      style={{ width, height, borderRadius: rounded }}
    />
  );
}

/** Card-shaped skeleton for KPI/dashboard cards. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 space-y-3 ${className}`}>
      <SkeletonBlock width="40%" height="0.75rem" />
      <SkeletonBlock width="60%" height="1.5rem" />
      <SkeletonBlock width="80%" height="0.625rem" />
    </div>
  );
}

/** Full-page dashboard skeleton. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonBlock width="30%" height="1.75rem" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <SkeletonBlock width="25%" height="1rem" />
          <SkeletonBlock height="200px" />
        </div>
        <div className="space-y-3">
          <SkeletonBlock width="35%" height="1rem" />
          <SkeletonBlock height="200px" />
        </div>
      </div>
    </div>
  );
}

/** Table-row skeleton for invoice lists. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      <div className="grid gap-4 px-4 py-3 border-b border-border" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={`th-${i}`} width="60%" height="0.75rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-4 px-4 py-3 border-b border-border" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, col) => (
            <SkeletonBlock key={`${row}-${col}`} width={col === 0 ? "90" : "70"} height="0.875rem" />
          ))}
        </div>
      ))}
    </div>
  );
}
