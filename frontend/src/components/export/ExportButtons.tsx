"use client";

import { useState } from "react";

interface ExportButtonsProps {
  /**
   * If "invoice" is set with a single id, fetches PDF from /api/invoices/[id]/pdf.
   * If "invoices" is set with N ids (or empty for "all"), fetches CSV from /api/invoices/export-csv.
   */
  type: "invoice" | "invoices";
  invoiceId?: string;
  invoiceIds?: string[];
  className?: string;
  size?: "sm" | "md";
}

/**
 * Reusable export buttons (PDF for single invoice, CSV for bulk).
 * Adapted from the ZIP version: uses fetch instead of tRPC, no toast lib.
 */
export function ExportButtons({ type, invoiceId, invoiceIds, className = "", size = "md" }: ExportButtonsProps) {
  const [busy, setBusy] = useState<null | "pdf" | "csv">(null);
  const [error, setError] = useState<string | null>(null);

  const padding = size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  async function handleExportPdf() {
    if (!invoiceId) {
      setError("invoiceId mancante");
      return;
    }
    setBusy("pdf");
    setError(null);
    try {
      // Open the PDF endpoint in a new tab — auth is via cookie
      window.open(`/api/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");
    } catch {
      setError("Errore export PDF");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportCsv() {
    setBusy("csv");
    setError(null);
    try {
      const res = await fetch("/api/invoices/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: invoiceIds && invoiceIds.length > 0 ? invoiceIds : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Errore export CSV");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `InvoiceStudio_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex gap-2">
        {type === "invoice" && invoiceId && (
          <button
            onClick={handleExportPdf}
            disabled={busy !== null}
            className={`${padding} ${textSize} rounded-lg bg-[#0d0e13] border border-[#1e2029] text-[#9ca3af] hover:text-[#f0f0f2] hover:bg-[#1a1c23] cursor-pointer transition-colors disabled:opacity-60 flex items-center gap-1.5`}
          >
            📄 <span className="hidden sm:inline">PDF</span>
          </button>
        )}

        {type === "invoices" && (
          <button
            onClick={handleExportCsv}
            disabled={busy !== null}
            className={`${padding} ${textSize} rounded-lg bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#6c63ff] hover:bg-[#6c63ff]/20 cursor-pointer transition-colors disabled:opacity-60 flex items-center gap-1.5`}
          >
            {busy === "csv" ? "⏳" : "📊"} <span className="hidden sm:inline">CSV</span>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default ExportButtons;
