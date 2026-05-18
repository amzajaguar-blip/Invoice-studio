import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";
import { sendInvoiceEmail } from "@/lib/email/resend";

/**
 * POST /api/invoices/[id]/send-email
 * Sends the invoice email with payment link to the client.
 * Requires the invoice to have a payment_link already generated.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: invoiceId } = await params;

  // Verify ownership and get invoice with client
  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*, clients(name, email), invoice_items(*)")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice.clients?.email) {
    return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
  }

  // Invoice must have a payment link before sending email
  const paymentLink = invoice.payment_link;
  if (!paymentLink) {
    return NextResponse.json(
      { error: "Nessun link di pagamento. Genera prima il link di pagamento." },
      { status: 400 }
    );
  }

  const currencySymbol: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    CHF: "Fr.",
  };
  const sym = currencySymbol[invoice.currency] || invoice.currency;

  try {
    await sendInvoiceEmail({
      to: invoice.clients.email,
      subject: `Fattura ${invoice.number} — InvoiceStudio`,
      invoiceNumber: invoice.number,
      clientName: invoice.clients.name,
      paymentLink,
      dueDate: invoice.due_date,
      totalFormatted: `${sym} ${invoice.total.toFixed(2)}`,
      notes: invoice.notes,
    });

    // Log event
    await supabase.from("invoice_events").insert({
      invoice_id: invoiceId,
      event_type: "sent",
      metadata: { email_sent_to: invoice.clients.email },
    });

    // Schedule first reminder (7 days before due date)
    const dueDate = new Date(invoice.due_date);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 7);

    if (reminderDate > new Date()) {
      await supabase.from("reminders").insert({
        invoice_id: invoiceId,
        scheduled_for: reminderDate.toISOString(),
      });
    }

    return NextResponse.json({ data: { sent: true, to: invoice.clients.email } });
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return NextResponse.json(
      { error: "Failed to send email. Check Resend configuration." },
      { status: 500 }
    );
  }
}
