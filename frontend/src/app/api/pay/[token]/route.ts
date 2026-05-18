import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import crypto from "crypto";

/**
 * POST /api/pay/[token]
 * Public endpoint — creates a fresh Stripe Checkout session for the given payment token.
 * Redirects the payer to Stripe for secure card payment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const supabase = createAdminClient();

  // Look up payment token
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("payment_tokens")
    .select("id, invoice_id, token_hash, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: "Link di pagamento non valido" }, { status: 404 });
  }

  if (tokenRecord.used_at) {
    return NextResponse.json({ error: "Fattura già pagata" }, { status: 400 });
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link di pagamento scaduto" }, { status: 410 });
  }

  // Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*, clients(name, email), invoice_items(*)")
    .eq("id", tokenRecord.invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Fattura non trovata" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Fattura già pagata" }, { status: 400 });
  }

  // Build line items
  const lineItems = invoice.invoice_items.map((item: { description: string; quantity: number; unit_price: number; tax_rate: number }) => ({
    price_data: {
      currency: invoice.currency.toLowerCase(),
      product_data: {
        name: item.description || `Voce fattura ${invoice.number}`,
      },
      unit_amount: Math.round(item.unit_price * 100),
    },
    quantity: item.quantity,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${token}`;

  // Create fresh Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: invoice.clients?.email,
    line_items: lineItems,
    metadata: {
      invoice_id: tokenRecord.invoice_id,
      payment_token_hash: tokenHash,
      payment_token_id: tokenRecord.id,
    },
    success_url: `${payUrl}?status=success`,
    cancel_url: `${payUrl}?status=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours for fresh sessions
  });

  if (!session.url) {
    return NextResponse.json({ error: "Errore nella creazione della sessione di pagamento" }, { status: 500 });
  }

  // Update the token record with the new session ID
  await supabase
    .from("payment_tokens")
    .update({ stripe_pi_id: session.id })
    .eq("id", tokenRecord.id);

  return NextResponse.json({
    data: {
      stripeUrl: session.url,
      invoiceId: tokenRecord.invoice_id,
    },
  });
}
