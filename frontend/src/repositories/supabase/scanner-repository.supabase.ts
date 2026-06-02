// ─── Scanner Repository — Supabase implementation ───

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ScannerRepository } from "@/repositories/interfaces/scanner-repository";
import type { ScannerExtractedData } from "@/types/states/scanner";

export function createScannerRepositorySupabase(
  supabase: SupabaseClient<Database>,
  orgId: string,
): ScannerRepository {
  return {
    async getRemainingScans(_orgId: string): Promise<number> {
      // Count OCR scans this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from("invoice_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "created")
        .gte("created_at", monthStart);

      if (error) throw new Error(error.message);

      const maxFree = 3;
      return Math.max(0, maxFree - (count ?? 0));
    },

    async processImage(
      _orgId: string,
      imageBase64: string,
    ): Promise<ScannerExtractedData> {
      // Call the real OCR API endpoint
      const response = await fetch("/api/ocr/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "OCR failed" }));
        throw new Error((err as { error?: string }).error ?? "Elaborazione OCR fallita");
      }

      const result = (await response.json()) as {
        vendor?: string;
        date?: string;
        total?: number;
        currency?: string;
        rawText?: string;
      };

      return {
        clientName: result.vendor ?? null,
        clientEmail: null,
        clientVatNumber: null,
        invoiceNumber: null,
        issueDate: result.date ?? new Date().toISOString().split("T")[0]!,
        dueDate: null,
        total: result.total ?? null,
        currency: result.currency ?? "EUR",
        items: result.total
          ? [{ description: "Servizi professionali", quantity: 1, unitPrice: result.total }]
          : [],
        rawText: result.rawText ?? "",
      };
    },

    async confirmAndCreateInvoice(
      _orgId: string,
      data: ScannerExtractedData,
    ): Promise<{ invoiceId: string }> {
      if (!data.clientName) throw new Error("Nome cliente mancante");

      // Create a draft invoice from extracted data
      const now = new Date().toISOString().split("T")[0]!;
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const due = thirtyDays.toISOString().split("T")[0]!;

      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const total = Math.round(subtotal * 0.8 * 100) / 100; // 20% withholding tax

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoice, error } = await (supabase as any)
        .from("invoices")
        .insert({
          org_id: orgId,
          client_id: "00000000-0000-0000-0000-000000000000",
          number: `FATT-${Date.now()}`,
          status: "draft",
          issue_date: data.issueDate ?? now,
          due_date: data.dueDate ?? due,
          subtotal,
          tax_rate: 0,
          withholding_tax_rate: 20,
          total,
          currency: (data.currency as string) ?? "EUR",
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      // Insert line items
      const items = data.items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: 0,
      }));

      if (items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("invoice_items").insert(items);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("invoice_events").insert({
        invoice_id: invoice.id,
        event_type: "created",
        metadata: { source: "scanner" },
      });

      return { invoiceId: invoice.id };
    },
  };
}
