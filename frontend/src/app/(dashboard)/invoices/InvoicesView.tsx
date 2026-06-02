"use client";

import { createClient } from "@/lib/supabase/client";
import { createInvoiceRepositorySupabase } from "@/repositories/supabase/invoice-repository.supabase";
import { useInvoiceListState } from "@/hooks/state/useInvoiceListState";
import { UiStateRenderer } from "@/components/ui-states";

interface InvoicesViewProps {
  orgId: string;
}

export function InvoicesView({ orgId }: InvoicesViewProps) {
  const supabase = createClient();
  const repo = createInvoiceRepositorySupabase(supabase);
  const { state, applyFilter, deleteInvoice, sendInvoice, retry } = useInvoiceListState(repo, orgId);

  return (
    <UiStateRenderer
      state={state}
      loadingVariant="table"
      emptyIcon="invoice"
      emptyAction={{ label: "Nuova Fattura", onPress: () => {} }}
    >
      {(data) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Fatture</h2>
            <span className="text-sm text-muted-foreground">{data.total} totale</span>
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
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.clientName}</p>
                  <p className="text-xs text-muted-foreground">{inv.number} · {inv.issueDate}</p>
                </div>
                <div className="flex items-center gap-3">
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
                      <button onClick={() => sendInvoice(inv.id)} className="text-xs px-2 py-1 rounded hover:bg-accent">Invia</button>
                    )}
                    <button onClick={() => deleteInvoice(inv.id)} className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600">Elimina</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </UiStateRenderer>
  );
}
