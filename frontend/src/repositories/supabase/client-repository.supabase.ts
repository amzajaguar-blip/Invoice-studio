// ─── Client Repository — Supabase implementation ───

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ClientRepository, CreateClientInput, UpdateClientInput } from "@/repositories/interfaces/client-repository";
import type { Client } from "@/types/models";
import { fromSupabaseClient } from "@/lib/mappers";

export function createClientRepositorySupabase(
  supabase: SupabaseClient<Database>,
): ClientRepository {
  return {
    async list(orgId: string): Promise<Client[]> {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("org_id", orgId)
        .order("name");

      if (error) throw new Error(error.message);
      return (data ?? []).map(fromSupabaseClient);
    },

    async getById(clientId: string): Promise<Client | null> {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw new Error(error.message);
      }
      return fromSupabaseClient(data);
    },

    async create(orgId: string, input: CreateClientInput): Promise<Client> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("clients")
        .insert({
          org_id: orgId,
          name: input.name,
          email: input.email,
          vat_number: input.vatNumber ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
          currency: "EUR",
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return fromSupabaseClient(data);
    },

    async update(clientId: string, input: UpdateClientInput): Promise<Client> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.email !== undefined) patch.email = input.email;
      if (input.vatNumber !== undefined) patch.vat_number = input.vatNumber;
      if (input.address !== undefined) patch.address = input.address;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.notes !== undefined) patch.notes = input.notes;

      if (Object.keys(patch).length === 0) {
        const existing = await this.getById(clientId);
        if (!existing) throw new Error("Client not found");
        return existing;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("clients")
        .update(patch)
        .eq("id", clientId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return fromSupabaseClient(data);
    },

    async delete(clientId: string): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (error) throw new Error(error.message);
    },
  };
}
