// ─── Invoice Repository — Supabase implementation ───
// Production data access. Replaces mock.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InvoiceRepository, CreateInvoiceInput, UpdateInvoiceInput } from "@/repositories/interfaces/invoice-repository";
import type { Invoice, InvoiceStatus } from "@/types/models";
import { fromSupabaseInvoice } from "@/lib/mappers";

export function createInvoiceRepositorySupabase(
  supabase: SupabaseClient<Database>,
): InvoiceRepository {
  return {
    async list(
      orgId: string,
      filter?: InvoiceStatus | "all",
      page = 1,
      pageSize = 20,
    ) {
      let query = supabase
        .from("invoices")
        .select("*, clients(*), invoice_items(*), invoice_events(*)", { count: "exact" })
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filter && filter !== "all") {
        query = query.eq("status", filter);
      }

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      const invoices = (data ?? []).map(fromSupabaseInvoice);
      const total = count ?? 0;
      const hasMore = total > from + pageSize;

      return { invoices, total, hasMore };
    },

    async getById(invoiceId: string) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // not found
        throw new Error(error.message);
      }
      return fromSupabaseInvoice(data);
    },

    async create(orgId: string, input: CreateInvoiceInput) {
      const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const withholdingTaxRate = input.withholdingTaxRate ?? 20;
      const total = Math.round(subtotal * (1 - withholdingTaxRate / 100) * 100) / 100;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoice, error } = await (supabase as any)
        .from("invoices")
        .insert({
          org_id: orgId,
          client_id: input.clientId,
          number: input.number,
          status: "draft",
          issue_date: input.issueDate,
          due_date: input.dueDate,
          subtotal,
          tax_rate: 0,
          withholding_tax_rate: withholdingTaxRate,
          total,
          currency: "EUR",
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Insert line items
      const items = input.items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate ?? 0,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: itemsError } = await (supabase as any).from("invoice_items").insert(items);
      if (itemsError) {
        // Rollback invoice on items failure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoices").delete().eq("id", invoice.id);
        throw new Error(itemsError.message);
      }

      // Log event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("invoice_events").insert({
        invoice_id: invoice.id,
        event_type: "created",
      });

      // Re-fetch with relations
      return (await this.getById(invoice.id))!;
    },

    async update(invoiceId: string, input: UpdateInvoiceInput) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      if (input.clientId !== undefined) patch.client_id = input.clientId;
      if (input.number !== undefined) patch.number = input.number;
      if (input.issueDate !== undefined) patch.issue_date = input.issueDate;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.notes !== undefined) patch.notes = input.notes;

      if (input.items) {
        const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const wr = input.withholdingTaxRate;
        patch.subtotal = subtotal;
        if (wr !== undefined) {
          patch.withholding_tax_rate = wr;
          patch.total = Math.round(subtotal * (1 - wr / 100) * 100) / 100;
        }
      }

      if (Object.keys(patch).length === 0) {
        const existing = await this.getById(invoiceId);
        if (!existing) throw new Error("Invoice not found");
        return existing;
      }

      patch.updated_at = new Date().toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("invoices")
        .update(patch)
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .single();

      if (error) throw new Error(error.message);

      // Replace items if provided
      if (input.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoice_items").delete().eq("invoice_id", invoiceId);
        const newItems = input.items.map((item) => ({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: item.taxRate ?? 0,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoice_items").insert(newItems);
      }

      return fromSupabaseInvoice(data);
    },

    async delete(invoiceId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .is("deleted_at", null);

      if (error) throw new Error(error.message);
    },

    async send(invoiceId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("invoices")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .single();

      if (error) throw new Error(error.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("invoice_events").insert({
        invoice_id: invoiceId,
        event_type: "sent",
      });

      return fromSupabaseInvoice(data);
    },

    async markPaid(invoiceId: string) {
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("invoices")
        .update({ status: "paid", paid_at: now, updated_at: now })
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .single();

      if (error) throw new Error(error.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("invoice_events").insert({
        invoice_id: invoiceId,
        event_type: "paid",
      });

      return fromSupabaseInvoice(data);
    },

    async cancel(invoiceId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("invoices")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .single();

      if (error) throw new Error(error.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("invoice_events").insert({
        invoice_id: invoiceId,
        event_type: "cancelled",
      });

      return fromSupabaseInvoice(data);
    },
  };
}
