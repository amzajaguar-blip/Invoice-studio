"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatItalianDate, daysAgo } from "@/lib/utils";
import type { Invoice } from "@/types";

interface InvoiceRowProps {
  invoice: Invoice;
  onSelect: (invoice: Invoice) => void;
  selected: boolean;
  // Multi-select
  checked: boolean;
  onCheck: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InvoiceRow({ invoice, onSelect, selected, checked, onCheck }: InvoiceRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={() => onSelect(invoice)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer border-b border-[#1a1c23] transition-colors"
      style={{
        background: checked
          ? "rgba(108,99,255,0.06)"
          : selected
          ? "#16181f"
          : hovered
          ? "#13151b"
          : "transparent",
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(invoice);
        }
      }}
      aria-label={`Fattura ${invoice.number}`}
    >
      {/* Checkbox */}
      <td className="py-3 px-3 w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={`Seleziona ${invoice.number}`}
          className="w-4 h-4 rounded border-[#1e2029] bg-[#111318] accent-[#6c63ff] cursor-pointer"
        />
      </td>
      <td className="py-3 px-4 text-sm font-medium text-[#f0f0f2]">
        {invoice.number}
      </td>
      <td className="py-3 px-4 text-sm text-[#e5e7eb]">
        {invoice.clients?.name || "—"}
      </td>
      <td className="py-3 px-4 text-sm" style={{ color: "#6c63ff" }}>
        {formatCurrency(invoice.total || 0, (invoice.currency as "EUR" | "USD" | "GBP" | "CHF") || "EUR")}
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={invoice.status as import("@/types").InvoiceStatus} />
      </td>
      <td className="py-3 px-4 text-sm text-[#9ca3af]">
        {invoice.issue_date ? formatItalianDate(invoice.issue_date) : "—"}
      </td>
      <td className="py-3 px-4 text-sm text-[#9ca3af]">
        {invoice.due_date ? daysAgo(invoice.due_date) : "—"}
      </td>
      <td className="py-3 px-4 text-sm text-[#6b7280] text-right">
        {invoice.paid_at ? formatItalianDate(invoice.paid_at) : "—"}
      </td>
    </tr>
  );
}
