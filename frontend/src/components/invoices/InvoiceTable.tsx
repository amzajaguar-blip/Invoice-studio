"use client";

import { useMemo, useState } from "react";
import { InvoiceRow } from "./InvoiceRow";
import { StatusBadge } from "./StatusBadge";
import type { Invoice, InvoiceStatus } from "@/types";

interface InvoiceTableProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  selectedId: string | null;
  // Multi-select
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const STATUS_FILTERS: Array<{ label: string; value: InvoiceStatus | "all" }> = [
  { label: "Tutte", value: "all" },
  { label: "Bozze", value: "draft" },
  { label: "Inviate", value: "sent" },
  { label: "Scadute", value: "overdue" },
  { label: "Pagate", value: "paid" },
];

export function InvoiceTable({
  invoices,
  onSelectInvoice,
  selectedId,
  selectedIds,
  onSelectionChange,
}: InvoiceTableProps) {
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter !== "all" && inv.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          inv.number?.toLowerCase().includes(q) ||
          inv.clients?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, filter, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id));

  function toggleAll() {
    if (allFilteredSelected) {
      // Deselect all filtered
      const next = new Set(selectedIds);
      filtered.forEach((inv) => next.delete(inv.id));
      onSelectionChange(next);
    } else {
      // Select all filtered
      const next = new Set(selectedIds);
      filtered.forEach((inv) => next.add(inv.id));
      onSelectionChange(next);
    }
  }

  function toggleOne(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border-none ${
                filter === f.value
                  ? "bg-[#6c63ff] text-white"
                  : "bg-[#111318] text-[#6b7280] hover:text-[#e5e7eb]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Cerca per numero o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-[#111318] border border-[#1e2029] rounded-lg px-3 py-1.5 text-sm text-[#f0f0f2] placeholder-[#6b7280] focus:outline-none focus:border-[#6c63ff] transition-colors"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8 text-center">
          <p className="text-[#6b7280]">
            {search || filter !== "all"
              ? "Nessuna fattura corrisponde ai filtri"
              : "Nessuna fattura ancora"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider border-b border-[#1a1c23]">
                {/* Select all checkbox */}
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    aria-label="Seleziona tutte"
                    className="w-4 h-4 rounded border-[#1e2029] bg-[#111318] accent-[#6c63ff] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Fattura</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Importo</th>
                <th className="py-3 px-4">Stato</th>
                <th className="py-3 px-4">Emessa</th>
                <th className="py-3 px-4">Scadenza</th>
                <th className="py-3 px-4 text-right">Pagata il</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onSelect={onSelectInvoice}
                  selected={inv.id === selectedId}
                  checked={selectedIds.has(inv.id)}
                  onCheck={(e) => toggleOne(inv.id, e)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#6b7280] mt-3">
        {filtered.length} fattur{filtered.length === 1 ? "a" : "e"}
        {selectedIds.size > 0 && (
          <span className="ml-2 text-[#6c63ff]">· {selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}</span>
        )}
      </p>
    </div>
  );
}
