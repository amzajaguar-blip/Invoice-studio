"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInvoiceRepositorySupabase } from "@/repositories/supabase/invoice-repository.supabase";
import { useInvoiceListState } from "@/hooks/state/useInvoiceListState";
import { UiStateRenderer } from "@/components/ui-states";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { InvoiceDetailPanel } from "@/components/invoices/InvoiceDetailPanel";
import type { Invoice } from "@/types/models";

interface InvoicesViewProps {
  orgId: string;
}

export function InvoicesView({ orgId }: InvoicesViewProps) {
  const supabase = createClient();
  const repo = createInvoiceRepositorySupabase(supabase);
  const { state, applyFilter, deleteInvoice, sendInvoice, retry } = useInvoiceListState(repo, orgId);

  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    retry(); // refresh list after creation
    setShowForm(false);
  }, [retry]);

  // Real send: generate payment link + send email via API routes
  const handleSend = useCallback(async (invoiceId: string) => {
    setSendingId(invoiceId);
    try {
      // 1. Generate Stripe payment link
      const linkRes = await fetch(`/api/invoices/${invoiceId}/generate-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Errore generazione link");
      }

      // 2. Send email with payment link
      const emailRes = await fetch(`/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!emailRes.ok) {
        const err = await emailRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Errore invio email");
      }

      // 3. Mark as sent in our state
      await sendInvoice(invoiceId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore nell'invio");
    } finally {
      setSendingId(null);
    }
  }, [sendInvoice]);

  const handleSelectInvoice = useCallback(async (invoiceId: string) => {
    const inv = await repo.getById(invoiceId);
    setSelectedInvoice(inv);
  }, [repo]);

  return (
    <>
      <UiStateRenderer
        state={state}
        loadingVariant="table"
        emptyIcon="invoice"
        emptyAction={{ label: "Crea prima fattura", onPress: () => setShowForm(true) }}
      >
        {(data) => (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Fatture</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{data.total} totale</span>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  + Nuova
                </button>
              </div>
            </div>
            {/* Filter bar */}
            <div className="flex gap-2">
              {(["all", "draft", "sent", "overdue", "paid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => applyFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    data.filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {f === "all" ? "Tutte" : f === "draft" ? "Bozze" : f === "sent" ? "Inviate" : f === "overdue" ? "Scadute" : "Pagate"}
                </button>
              ))}
            </div>
            {/* Invoice list */}
            <div className="rounded-lg border border-border overflow-hidden">
              {data.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleSelectInvoice(inv.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{inv.clientName}</p>
                    <p className="text-xs text-muted-foreground">{inv.number} · {inv.issueDate}</p>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === "paid" ? "bg-green-100 text-green-700" :
                      inv.status === "overdue" ? "bg-red-100 text-red-700" :
                      inv.status === "sent" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {inv.status === "paid" ? "Pagata" : inv.status === "overdue" ? "Scaduta" : inv.status === "sent" ? "Inviata" : "Bozza"}
                    </span>
                    <span className="text-sm font-medium">€{inv.total.toFixed(0)}</span>
                    <div className="flex gap-1">
                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleSend(inv.id)}
                          disabled={sendingId === inv.id}
                          className="text-xs px-2 py-1 rounded hover:bg-accent disabled:opacity-50"
                        >
                          {sendingId === inv.id ? "Invio..." : "Invia"}
                        </button>
                      )}
                      <button
                        onClick={() => deleteInvoice(inv.id)}
                        className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </UiStateRenderer>

      {/* Create Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <InvoiceForm
              onClose={() => setShowForm(false)}
              onSave={handleCreate}
            />
          </div>
        </div>
      )}

      {/* Invoice Detail Panel */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/50" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* @ts-expect-error — InvoiceDetailPanel expects legacy type with joined relations */}
            <InvoiceDetailPanel
              invoice={selectedInvoice as any}
              onClose={() => {
                setSelectedInvoice(null);
                retry();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
