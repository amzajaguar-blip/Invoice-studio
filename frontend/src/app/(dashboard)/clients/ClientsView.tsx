"use client";

import { createClient } from "@/lib/supabase/client";
import { createClientRepositorySupabase } from "@/repositories/supabase/client-repository.supabase";
import { useClientListState } from "@/hooks/state/useClientListState";
import { UiStateRenderer } from "@/components/ui-states";

interface ClientsViewProps {
  orgId: string;
}

export function ClientsView({ orgId }: ClientsViewProps) {
  const supabase = createClient();
  const repo = createClientRepositorySupabase(supabase);
  const { state, deleteClient } = useClientListState(repo, orgId);

  return (
    <UiStateRenderer
      state={state}
      loadingVariant="table"
      emptyIcon="client"
      emptyAction={{ label: "Nuovo Cliente", onPress: () => {} }}
    >
      {(data) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Clienti</h2>
            <span className="text-sm text-muted-foreground">{data.total} totale</span>
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
  );
}
