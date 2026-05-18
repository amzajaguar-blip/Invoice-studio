import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events with signature verification.
 * Receives: checkout.session.completed, checkout.session.expired
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        const paymentTokenId = session.metadata?.payment_token_id;
        const paymentTokenHash = session.metadata?.payment_token_hash;

        if (!invoiceId) break;

        // Idempotency guard — check if already paid (Stripe may retry webhooks)
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("status")
          .eq("id", invoiceId)
          .single();

        if (existingInvoice?.status === "paid") {
          console.log(`Invoice ${invoiceId} already paid — skipping webhook`);
          break;
        }

        // Mark invoice as paid
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        // Mark payment token as used (by ID if available, else by hash)
        if (paymentTokenId) {
          await supabase
            .from("payment_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("id", paymentTokenId);
        } else if (paymentTokenHash) {
          await supabase
            .from("payment_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("token_hash", paymentTokenHash);
        }

        // Log event
        await supabase.from("invoice_events").insert({
          invoice_id: invoiceId,
          event_type: "paid",
          metadata: { stripe_session_id: session.id },
        });

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentTokenId = session.metadata?.payment_token_id;
        const paymentTokenHash = session.metadata?.payment_token_hash;

        // Only clear used_at if it was this specific session that expired
        // (don't interfere with a successful payment from another session on the same token)
        if (paymentTokenId) {
          const { data: token } = await supabase
            .from("payment_tokens")
            .select("used_at, stripe_pi_id")
            .eq("id", paymentTokenId)
            .single();

          // Only reset if the token wasn't already used by a different session
          if (token && !token.used_at && token.stripe_pi_id === session.id) {
            await supabase
              .from("payment_tokens")
              .update({ stripe_pi_id: null })
              .eq("id", paymentTokenId);
          }
        } else if (paymentTokenHash) {
          const { data: token } = await supabase
            .from("payment_tokens")
            .select("used_at, stripe_pi_id")
            .eq("token_hash", paymentTokenHash)
            .single();

          if (token && !token.used_at && token.stripe_pi_id === session.id) {
            await supabase
              .from("payment_tokens")
              .update({ stripe_pi_id: null })
              .eq("token_hash", paymentTokenHash);
          }
        }

        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
