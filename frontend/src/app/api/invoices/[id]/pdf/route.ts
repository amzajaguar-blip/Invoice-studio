import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";
import { generateInvoicePDF, type PDFInvoiceData } from "@/lib/pdf/InvoicePDF";

/**
 * GET /api/invoices/[id]/pdf
 * Generates and returns a PDF of the invoice.
 * Only accessible by the invoice owner (authenticated).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: invoiceId } = await params;

  // Fetch invoice with all relations
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, clients(name, email, vat_number, address), invoice_items(*), organizations!invoices_org_id_fkey(name)")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Map to PDF data format
  const pdfData: PDFInvoiceData = {
    number: invoice.number,
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    clientName: invoice.clients?.name || "—",
    clientEmail: invoice.clients?.email || "",
    clientAddress: invoice.clients?.address,
    clientVatNumber: invoice.clients?.vat_number,
    currency: invoice.currency,
    items: (invoice.invoice_items || []).map((item: { description: string; quantity: number; unit_price: number }) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
    subtotal: invoice.subtotal,
    taxRate: invoice.tax_rate,
    withholdingTaxRate: invoice.withholding_tax_rate,
    total: invoice.total,
    notes: invoice.notes,
    orgName: invoice.organizations?.name,
  };

  try {
    const pdfBuffer = await generateInvoicePDF(pdfData);

    // Log event
    await supabase.from("invoice_events").insert({
      invoice_id: invoiceId,
      event_type: "viewed",
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Fattura_${invoice.number}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
