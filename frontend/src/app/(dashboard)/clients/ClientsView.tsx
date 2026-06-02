"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClientRepositorySupabase } from "@/repositories/supabase/client-repository.supabase";
import { useClientListState } from "@/hooks/state/useClientListState";
import { UiStateRenderer } from "@/components/ui-states";
import { ClientForm } from "@/components/clients/ClientForm";

interface ClientsViewProps {
  orgId: string;
}

export function ClientsView({ orgId }: ClientsViewProps) {
  const supabase = createClient();
  const repo = createClientRepositorySupabase(supabase);
  const { state, refresh, deleteClient } = useClientListState(repo, orgId);
  const [showForm, setShowForm] = useState(false);

  const handleClientCreated = useCallback(() => {
    setShowForm(false);
    refresh();
  }, [refresh]);

  return (
    <>
      <UiStateRenderer
        state={state}
        loadingVariant="table"
        emptyIcon="client"
        emptyAction={{ label: "Nuovo Cliente", onPress: () => setShowForm(true) }}
      >
        {(data) => (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Clienti</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{data.total} totale</span>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  + Nuovo
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {data.clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.email}{c.vatNumber ? ` · P.IVA ${c.vatNumber}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteClient(c.id)}
                    className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600"
                  >
                    Elimina
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </UiStateRenderer>

      {/* Create Client Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <ClientForm onClose={() => setShowForm(false)} onSave={handleClientCreated} />
          </div>
        </div>
      )}
    </>
  );
}
