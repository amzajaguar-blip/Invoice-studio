"use client";

import { createClient } from "@/lib/supabase/client";
import { createSettingsRepositorySupabase } from "@/repositories/supabase/settings-repository.supabase";
import { useSettingsState } from "@/hooks/state/useSettingsState";
import { UiStateRenderer } from "@/components/ui-states";

interface SettingsViewProps {
  orgId: string;
}

export function SettingsView({ orgId }: SettingsViewProps) {
  const supabase = createClient();
  const repo = createSettingsRepositorySupabase(supabase, orgId);
  const { state, setSection, save } = useSettingsState(repo, orgId);

  return (
    <UiStateRenderer state={state} loadingVariant="cards">
      {(data) => (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Impostazioni</h2>
          {/* Section tabs */}
          <div className="flex gap-2 border-b border-border pb-2">
            {(["profile", "workspace", "billing", "security"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`text-sm px-3 py-1.5 rounded-t ${
                  data.activeSection === s
                    ? "border-b-2 border-primary text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "profile" ? "Profilo" : s === "workspace" ? "Organizzazione" : s === "billing" ? "Fatturazione" : "Sicurezza"}
              </button>
            ))}
          </div>
          {/* Content */}
          {data.activeSection === "profile" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-1">Nome organizzazione</label>
                <input
                  type="text"
                  defaultValue={data.organization.name}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Piano</label>
                <p className="text-sm text-muted-foreground capitalize">{data.organization.plan}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ritenuta d&apos;acconto predefinita</label>
                <p className="text-sm text-muted-foreground">{data.settings.withholdingTaxRate}%</p>
              </div>
              <button
                onClick={() => save({ withholdingTaxRate: 20 })}
                disabled={data.isSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                {data.isSaving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          )}
          {data.activeSection !== "profile" && (
            <p className="text-sm text-muted-foreground py-8">Sezione in arrivo — disponibile a breve.</p>
          )}
        </div>
      )}
    </UiStateRenderer>
  );
}
