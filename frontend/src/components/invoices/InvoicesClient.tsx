"use client";

import { useState, useEffect, useCallback, useRef, type RefObject } from "react";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { InvoiceDetailPanel } from "@/components/invoices/InvoiceDetailPanel";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { LimitWarningBanner } from "@/components/rewards/LimitWarningBanner";
import { HardLimitModal } from "@/components/rewards/HardLimitModal";
import { RewardedAdModal } from "@/components/rewards/RewardedAdModal";
import { useQuota } from "@/hooks/useRewards";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/types";

export function InvoicesClient({
  initialInvoices,
  orgId,
}: {
  initialInvoices: Invoice[];
  orgId: string | null;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remindedInvoices, setRemindedInvoices] = useState<Set<string>>(new Set());
  const newInvoiceBtnRef = useRef<HTMLButtonElement>(null);

  // ─── Multi-select state ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // ─── Quota & Rewarded Ads state ─────────────────────────────────────────

  const { quota, refresh: refreshQuota } = useQuota();
  const [showHardLimit, setShowHardLimit] = useState(false);
  const [showRewardedAd, setShowRewardedAd] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name, email, vat_number), invoice_items(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (data) {
      setInvoices(data as Invoice[]);
    }
    setLoading(false);
  }, []);

  // Auto-refresh on mount if server didn't provide data
  const loadedRef = useRef(false);
  useEffect(() => {
    if (initialInvoices.length === 0 && !loadedRef.current) {
      loadedRef.current = true;
      const supabase = createClient();
      supabase
        .from("invoices")
        .select("*, clients(name, email, vat_number), invoice_items(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (data) setInvoices(data as Invoice[]);
        });
    }
  }, [initialInvoices.length]);

  const handleSelectInvoice = async (invoice: Invoice) => {
    // Fetch full detail with events
    const supabase = createClient();
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(*), invoice_items(*), invoice_events(*)")
      .eq("id", invoice.id)
      .single();

    if (data) {
      setSelected(data as unknown as typeof selected);
    } else {
      setSelected(invoice);
    }
  };

  // ─── New invoice handler with plan enforcement ──────────────────────────

  const handleNewInvoice = () => {
    if (!quota) return;

    if (!quota.canCreateInvoice) {
      setShowHardLimit(true);
      return;
    }

    setShowNew(true);
  };

  // ─── After invoice save: refresh quota + list ───────────────────────────

  const handleInvoiceSaved = () => {
    loadInvoices();
    refreshQuota();
    setSelectedIds(new Set()); // Clear selection after save
  };

  // ─── Rewarded ad claimed: open invoice form ─────────────────────────────

  const handleRewardClaimed = () => {
    setShowRewardedAd(false);
    refreshQuota().then((newQuota) => {
      if (newQuota?.canCreateInvoice) {
        setShowNew(true);
      }
    });
  };

  // ─── Upgrade handler → Settings > Piano tab ─────────────────────────────

  const handleUpgrade = () => {
    window.location.href = "/settings#piano";
  };

  // ─── Bulk: delete selected invoices ────────────────────────────────────

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Eliminare ${selectedIds.size} fattur${selectedIds.size === 1 ? "a" : "e"}? Questa azione è reversibile solo dal database.`
    );
    if (!confirmed) return;

    setBulkLoading(true);
    setBulkError(null);

    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/invoices/${id}`, { method: "DELETE" })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) setBulkError(`${failed} eliminazione/i fallita/e`);
      setSelectedIds(new Set());
      await loadInvoices();
    } catch {
      setBulkError("Errore durante l'eliminazione. Riprova.");
    } finally {
      setBulkLoading(false);
    }
  };

  // ─── Bulk: export CSV ───────────────────────────────────────────────────

  const handleBulkExportCSV = async () => {
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/invoices/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setBulkError(err.error || "Errore export");
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
      setBulkError("Errore di rete. Riprova.");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      {/* ── Limit Warning Banner ─────────────────────────────────── */}
      {quota && !quota.unlimited && (
        <div className="mb-4">
          <LimitWarningBanner
            quota={quota}
            onWatchAd={orgId ? () => setShowRewardedAd(true) : undefined}
            onUpgrade={handleUpgrade}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#f0f0f2] font-[Georgia,serif]">
            Fatture
          </h2>
          <p className="text-[#6b7280] text-sm mt-1">
            {invoices.length} fattur{invoices.length === 1 ? "a" : "e"}
            {quota && !quota.unlimited && (
              <span className="ml-2">
                · {quota.currentMonthInvoices}/{quota.planLimit + quota.rewardedCredits}{" "}
                questo mese
                {quota.rewardedCredits > 0 && (
                  <span className="text-[#22c55e]">
                    {" "}
                    (+{quota.rewardedCredits} extra)
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
        <button
          ref={newInvoiceBtnRef}
          onClick={handleNewInvoice}
          className="bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors border-none cursor-pointer"
        >
          ✦ Nuova Fattura
        </button>
      </div>

      {/* ── Bulk Toolbar ──────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-[#111318] border border-[#6c63ff]/30 rounded-xl px-4 py-3">
          <span className="text-sm text-[#6c63ff] font-medium flex-1">
            {selectedIds.size} fattur{selectedIds.size === 1 ? "a" : "e"} selezionat{selectedIds.size === 1 ? "a" : "e"}
          </span>
          <button
            onClick={handleBulkExportCSV}
            disabled={bulkLoading}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20 hover:bg-[#6c63ff]/20 transition-colors cursor-pointer"
          >
            {bulkLoading ? "⏳" : "📥"} Esporta CSV
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            {bulkLoading ? "⏳" : "🗑"} Elimina
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[#6b7280] hover:text-[#e5e7eb] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk error */}
      {bulkError && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          {bulkError}
        </div>
      )}

      {loading && invoices.length === 0 ? (
        <div className="bg-[#111318] border border-[#1e2029] rounded-xl p-8">
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-[#1e2029] rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <InvoiceTable
          invoices={invoices}
          onSelectInvoice={handleSelectInvoice}
          selectedId={selected?.id ?? null}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* New Invoice Modal */}
      {showNew && (
        <InvoiceForm
          onClose={() => setShowNew(false)}
          onSave={handleInvoiceSaved}
          triggerRef={newInvoiceBtnRef as RefObject<HTMLElement | null>}
        />
      )}

      {/* Hard Limit Modal */}
      {showHardLimit && quota && (
        <HardLimitModal
          quota={quota}
          onClose={() => setShowHardLimit(false)}
          onWatchAd={
            orgId && quota.showRewardedAdOption
              ? () => {
                  setShowHardLimit(false);
                  setShowRewardedAd(true);
                }
              : undefined
          }
          onUpgrade={handleUpgrade}
        />
      )}

      {/* Rewarded Ad Modal */}
      {showRewardedAd && orgId && (
        <RewardedAdModal
          orgId={orgId}
          onClose={() => setShowRewardedAd(false)}
          onRewardClaimed={handleRewardClaimed}
        />
      )}

      {/* Detail Panel */}
      {selected && (
        <InvoiceDetailPanel
          invoice={selected}
          onClose={() => setSelected(null)}
          reminded={remindedInvoices.has(selected.id)}
          onRemind={() =>
            setRemindedInvoices((prev) => new Set(prev).add(selected.id))
          }
        />
      )}
    </div>
  );
}
