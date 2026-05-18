import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import crypto from "crypto";

/**
 * POST /api/invoices/[id]/generate-payment-link
 * Generates a Stripe Checkout payment link for a specific invoice.
 * Creates a payment token that the client can use to pay without authentication.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: invoiceId } = await params;

  // Verify invoice ownership and get details
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

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  if (invoice.status === "cancelled") {
    return NextResponse.json({ error: "Invoice is cancelled" }, { status: 400 });
  }

  // Generate a random payment token (sent to client in plain text)
  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${token}`;

  // Build line items for Stripe Checkout
  const lineItems = invoice.invoice_items.map((item: { description: string; quantity: number; unit_price: number; tax_rate: number }) => ({
    price_data: {
      currency: invoice.currency.toLowerCase(),
      product_data: {
        name: item.description,
      },
      unit_amount: Math.round(item.unit_price * 100), // Stripe uses cents
    },
    quantity: item.quantity,
  }));

  // Insert payment token record FIRST — we need the DB ID for Stripe metadata
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("payment_tokens")
    .insert({
      invoice_id: invoiceId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .select("id")
    .single();

  if (tokenError || !tokenRecord) {
    console.error("Failed to insert payment token:", tokenError);
    return NextResponse.json({ error: "Failed to create payment token" }, { status: 500 });
  }

  const paymentTokenId = tokenRecord.id;

  // Stripe tax handling — Italian law: IVA + ritenuta d'acconto
  const stripeTaxRate = invoice.tax_rate > 0 ? await getOrCreateStripeTaxRate(invoice.tax_rate) : null;
  const stripeWithholdingRate = invoice.withholding_tax_rate > 0 ? await getOrCreateStripeTaxRate(-invoice.withholding_tax_rate) : null;

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: invoice.clients?.email,
    line_items: lineItems.map((item: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }) => ({
      ...item,
      tax_rates: [
        ...(stripeTaxRate ? [stripeTaxRate] : []),
        ...(stripeWithholdingRate ? [stripeWithholdingRate] : []),
      ],
    })),
    metadata: {
      invoice_id: invoiceId,
      payment_token_id: paymentTokenId,
      payment_token_hash: tokenHash,
    },
    success_url: `${payUrl}?status=success`,
    cancel_url: `${payUrl}?status=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 86400, // 30 days
  });

  if (!session.url) {
    // Rollback token insert on failure
    await supabase.from("payment_tokens").delete().eq("id", paymentTokenId);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  // Update token with Stripe session ID
  await supabase
    .from("payment_tokens")
    .update({ stripe_pi_id: session.id })
    .eq("id", paymentTokenId);

  // Update invoice with payment link and status
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      payment_link: payUrl,
      status: "sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (updateError) {
    console.error("Failed to update invoice:", updateError);
  }

  // Log event
  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    event_type: "sent",
    metadata: { payment_link: payUrl },
  });

  return NextResponse.json({
    data: {
      token,
      payUrl,
      stripeUrl: session.url,
      invoiceId,
    },
  });
}

/**
 * Creates (or reuses) a Stripe Tax Rate for the given percentage.
 * Italian VAT is typically 22% (standard), 4%, or 10%.
 * For ritenuta d'acconto, we create a negative tax rate.
 */
async function getOrCreateStripeTaxRate(percentage: number): Promise<string | null> {
  if (percentage === 0) return null;

  const displayName = percentage > 0
    ? `IVA ${percentage}%`
    : `Ritenuta d'acconto ${Math.abs(percentage)}%`;

  // Search for existing tax rate
  const existing = await stripe.taxRates.list({
    active: true,
    limit: 1,
  });

  const match = existing.data.find((tr) => tr.display_name === displayName);
  if (match) return match.id;

  // Create new tax rate
  const taxRate = await stripe.taxRates.create({
    display_name: displayName,
    percentage: Math.abs(percentage),
    inclusive: false,
    jurisdiction: "IT",
  });

  return taxRate.id;
}
