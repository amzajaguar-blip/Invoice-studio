"use client";

/**
 * InvoiceRow — P1.1 token-driven table row
 * ==========================================
 * All colours driven by CSS variables — no raw hex.
 * Selected, hovered and checked states use token-backed
 * backgrounds for full dark/light mode support.
 */

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatItalianDate, daysAgo } from "@/lib/utils";
import type { Invoice } from "@/types";

interface InvoiceRowProps {
  invoice: Invoice;
  onSelect: (invoice: Invoice) => void;
  selected: boolean;
  checked: boolean;
  onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InvoiceRow({
  invoice,
  onSelect,
  selected,
  checked,
  onCheck,
}: InvoiceRowProps) {
  const [hovered, setHovered] = useState(false);

  // ── Background priority: checked > selected > hovered > transparent ──────
  let bgVar = "transparent";
  if (checked)   bgVar = "color-mix(in srgb, var(--accent) 6%, transparent)";
  else if (selected) bgVar = "var(--surface-secondary)";
  else if (hovered)  bgVar = "var(--surface-tertiary)";

  return (
    <tr
      onClick={() => onSelect(invoice)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer border-b border-[var(--border-secondary)] transition-colors duration-[var(--duration-micro)]"
      style={{ background: bgVar }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(invoice);
        }
      }}
      aria-selected={selected}
      aria-label={`Fattura ${invoice.number}`}
    >
      {/* Checkbox */}
      <td className="py-3 px-3 w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={`Seleziona ${invoice.number}`}
          className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--surface-secondary)] accent-[var(--accent)] cursor-pointer"
        />
      </td>

      {/* Number */}
      <td className="py-3 px-4 text-sm font-medium text-[var(--text-primary)]">
        {invoice.number}
      </td>

      {/* Client */}
      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
        {invoice.clients?.name || "—"}
      </td>

      {/* Amount */}
      <td className="py-3 px-4 text-sm font-semibold text-[var(--accent)]">
        {formatCurrency(
          invoice.total || 0,
          (invoice.currency as "EUR" | "USD" | "GBP" | "CHF") || "EUR"
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <StatusBadge status={invoice.status as import("@/types").InvoiceStatus} />
      </td>

      {/* Issue date */}
      <td className="py-3 px-4 text-sm text-[var(--text-muted)]">
        {invoice.issue_date ? formatItalianDate(invoice.issue_date) : "—"}
      </td>

      {/* Due date */}
      <td className="py-3 px-4 text-sm text-[var(--text-muted)]">
        {invoice.due_date ? daysAgo(invoice.due_date) : "—"}
      </td>

      {/* Paid at */}
      <td className="py-3 px-4 text-sm text-[var(--text-muted)] text-right">
        {invoice.paid_at ? formatItalianDate(invoice.paid_at) : "—"}
      </td>
    </tr>
  );
}
