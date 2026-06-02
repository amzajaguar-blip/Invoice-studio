// ─── Settings Repository — Supabase implementation ───

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SettingsRepository } from "@/repositories/interfaces/settings-repository";
import type { Organization, OrganizationSettings } from "@/types/models";
import { fromSupabaseOrganization } from "@/lib/mappers";

export function createSettingsRepositorySupabase(
  supabase: SupabaseClient<Database>,
  orgId: string,
): SettingsRepository {
  return {
    async getSettings(_orgId: string) {
      const { data: org, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (error) throw new Error(error.message);

      type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
      const row = org as OrgRow;
      const organization: Organization = fromSupabaseOrganization(row);

      // OrganizationSettings — derived from organization + hardcoded defaults for now
      // In production, these would be columns on the organizations table
      const settings: OrganizationSettings = {
        orgId: row.id,
        currency: "EUR",
        defaultTaxRate: 0,
        withholdingTaxRate: 20,
        invoicePrefix: "FATT-",
        nextInvoiceNumber: 1,
        defaultPaymentTerms: 30,
      };

      return { organization, settings };
    },

    async updateSettings(_orgId: string, update: Partial<OrganizationSettings>) {
      // Minimal update — full org settings need a dedicated table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("organizations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", orgId);
      if (error) throw new Error(error.message);

      // Return merged settings
      const { settings } = await this.getSettings(orgId);
      return { ...settings, ...update };
    },
  };
}
