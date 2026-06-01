/**
 * StatusBadge — P1.1 token-driven status indicator
 * ==================================================
 * Uses CSS variable–backed classes from globals.css.
 * No raw hex values. Dark/light mode automatic via CSS tokens.
 */

import type { InvoiceStatus } from "@/types";

const STATUS_META: Record<
  InvoiceStatus,
  { label: string; cls: string }
> = {
  paid:      { label: "Pagata",    cls: "status-paid" },
  sent:      { label: "Inviata",   cls: "status-pending" },
  overdue:   { label: "Scaduta",   cls: "status-overdue" },
  draft:     { label: "Bozza",     cls: "status-draft" },
  cancelled: { label: "Annullata", cls: "status-draft" },
};

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;

  return (
    <span className={`status-badge ${meta.cls}`} role="status">
      {meta.label}
    </span>
  );
}
