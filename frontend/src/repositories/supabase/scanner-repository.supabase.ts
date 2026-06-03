// ─── Scanner Repository — Supabase implementation (V21 OCR Intake Engine) ───

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ScannerRepository } from "@/repositories/interfaces/scanner-repository";
import type { ScannerExtractedData } from "@/types/states/scanner";

export function createScannerRepositorySupabase(
  supabase: SupabaseClient<Database>,
  orgId: string,
): ScannerRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  return {
    async getRemainingScans(_orgId: string): Promise<number> {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count, error } = await db
        .from("invoice_ocr_jobs")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .gte("created_at", monthStart);

      if (error) throw new Error(error.message);

      const maxFree = 3;
      return Math.max(0, maxFree - (count ?? 0));
    },

    async processImage(
      _orgId: string,
      imageBase64: string,
    ): Promise<ScannerExtractedData> {
      const response = await fetch("/api/ocr/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "OCR failed" }));
        throw new Error((err as { error?: string }).error ?? "Elaborazione OCR fallita");
      }

      const json = (await response.json()) as {
        success: boolean;
        data?: {
          supplierName?: string | null;
          vatNumber?: string | null;
          invoiceNumber?: string | null;
          invoiceDate?: string | null;
          taxableAmount?: number | null;
          vatAmount?: number | null;
          totalAmount?: number | null;
          currency?: string;
          rawText?: string;
        };
        error?: string;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error ?? "OCR processing failed");
      }

      const d = json.data;

      return {
        clientName: d.supplierName ?? null,
        clientEmail: null,
        clientVatNumber: d.vatNumber ?? null,
        invoiceNumber: d.invoiceNumber ?? null,
        issueDate: d.invoiceDate ?? null,
        dueDate: null,
        total: d.totalAmount ?? null,
        currency: d.currency ?? "EUR",
        items: d.totalAmount
          ? [{ description: "Servizi professionali", quantity: 1, unitPrice: d.totalAmount }]
          : [],
        rawText: d.rawText ?? "",
      };
    },

    // ─── P0-2: confirmAndCreateInvoice — OCR audit trail ─────────────────

    async confirmAndCreateInvoice(
      _orgId: string,
      data: ScannerExtractedData,
      ocrConfidence?: Record<string, number>,
    ): Promise<{ invoiceId: string }> {
      if (!data.clientName) throw new Error("Nome cliente mancante");

      // ── P0-2a: Insert OCR job record ──────────────────────────────────

      const { data: job, error: jobError } = await db
        .from("invoice_ocr_jobs")
        .insert({
          org_id: orgId,
          file_url: data.rawText ? "ocr://memory" : "ocr://unknown",
          file_name: null,
          status: "completed",
          confidence: ocrConfidence?.overall ?? null,
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Creazione job OCR fallita: ${jobError.message}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobId: string = (job as any).id;

      // ── Invoice creation (wrapped so we can mark job as failed on error) ──

      try {
        // 1. Look up or create client
        let clientId: string;

        if (data.clientVatNumber) {
          const { data: existing } = await db
            .from("clients")
            .select("id")
            .eq("org_id", orgId)
            .eq("vat_number", data.clientVatNumber)
            .maybeSingle();
          if (existing) {
            clientId = existing.id;
          } else {
            clientId = await createClient();
          }
        } else {
          const { data: byName } = await db
            .from("clients")
            .select("id")
            .eq("org_id", orgId)
            .eq("name", data.clientName)
            .maybeSingle();
          if (byName) {
            clientId = byName.id;
          } else {
            clientId = await createClient();
          }
        }

        async function createClient(): Promise<string> {
          const { data: created, error } = await db
            .from("clients")
            .insert({
              org_id: orgId,
              name: data.clientName!,
              email: data.clientEmail ?? `${data.clientName!.replace(/\s+/g, ".").toLowerCase()}@unknown.it`,
              vat_number: data.clientVatNumber ?? null,
              currency: (data.currency as string) ?? "EUR",
            })
            .select("id")
            .single();
          if (error) throw new Error(`Creazione cliente fallita: ${error.message}`);
          return created.id;
        }

        // 2. Generate invoice number (INV-YYYY-NNN format)
        const year = new Date().getFullYear();
        const { data: lastInvoice } = await db
          .from("invoices")
          .select("number")
          .eq("org_id", orgId)
          .like("number", `INV-${year}-%`)
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextNum = 1;
        if (lastInvoice?.number) {
          const match = lastInvoice.number.match(/INV-\d{4}-(\d+)/);
          if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const invoiceNumber = `INV-${year}-${String(nextNum).padStart(3, "0")}`;

        // 3. Calculate totals
        const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const withholdingTaxRate = 20;
        const total = Math.round(subtotal * (1 - withholdingTaxRate / 100) * 100) / 100;

        const now = new Date().toISOString().split("T")[0]!;
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        const due = thirtyDays.toISOString().split("T")[0]!;

        // 4. Create invoice
        const { data: invoice, error: invError } = await db
          .from("invoices")
          .insert({
            org_id: orgId,
            client_id: clientId,
            number: invoiceNumber,
            status: "draft",
            issue_date: data.issueDate ?? now,
            due_date: data.dueDate ?? due,
            subtotal,
            tax_rate: 0,
            withholding_tax_rate: withholdingTaxRate,
            total,
            currency: (data.currency as string) ?? "EUR",
            notes: data.rawText ? `OCR text: ${data.rawText.slice(0, 200)}` : null,
          })
          .select("id")
          .single();

        if (invError) throw new Error(invError.message);

        // 5. Insert line items
        const items = data.items.map((item) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: 0,
        }));

        if (items.length > 0) {
          const { error: itemsError } = await db.from("invoice_items").insert(items);
          if (itemsError) {
            await db.from("invoices").delete().eq("id", invoice.id);
            throw new Error(itemsError.message);
          }
        }

        // 6. Log event
        await db.from("invoice_events").insert({
          invoice_id: invoice.id,
          event_type: "created",
          metadata: { source: "ocr_scanner" },
        });

        // ── P0-2b: Insert OCR results with per-field confidence ─────────

        const { error: resultError } = await db.from("invoice_ocr_results").insert({
          job_id: jobId,
          supplier_name: data.clientName,
          vat_number: data.clientVatNumber,
          invoice_number: data.invoiceNumber,
          invoice_date: data.issueDate,
          total_amount: data.total,
          raw_text: data.rawText,
          confidence_supplier_name: ocrConfidence?.supplierName ?? null,
          confidence_vat_number: ocrConfidence?.vatNumber ?? null,
          confidence_invoice_number: ocrConfidence?.invoiceNumber ?? null,
          confidence_invoice_date: ocrConfidence?.invoiceDate ?? null,
          confidence_total_amount: ocrConfidence?.totalAmount ?? null,
        });

        // Non-blocking: log but don't fail the save if result insert fails
        if (resultError) {
          console.error("[OCR] Failed to insert ocr_results:", resultError.message);
        }

        return { invoiceId: invoice.id };
      } catch (err) {
        // Mark the job as failed so the audit trail records the failure
        await db
          .from("invoice_ocr_jobs")
          .update({ status: "failed" })
          .eq("id", jobId);

        throw err;
      }
    },
  };
}
