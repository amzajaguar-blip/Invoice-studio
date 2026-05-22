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

  // ─── Upgrade handler ────────────────────────────────────────────────────

  const handleUpgrade = () => {
    // TODO: Stripe checkout/portal integration
    window.location.href = "/settings"; // placeholder
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
