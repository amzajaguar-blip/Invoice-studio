import type { InvoiceStatus } from "@/types";

const STATUS_META: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  paid: { label: "Pagata", color: "#22c55e", bg: "rgba(34,197,94,0.12)", dot: "#22c55e" },
  sent: { label: "Inviata", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", dot: "#f59e0b" },
  overdue: { label: "Scaduta", color: "#ef4444", bg: "rgba(239,68,68,0.12)", dot: "#ef4444" },
  draft: { label: "Bozza", color: "#6b7280", bg: "rgba(107,114,128,0.12)", dot: "#6b7280" },
  cancelled: { label: "Annullata", color: "#6b7280", bg: "rgba(107,114,128,0.12)", dot: "#6b7280" },
};

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      {meta.label}
    </span>
  );
}
