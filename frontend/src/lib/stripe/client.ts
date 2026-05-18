import Stripe from "stripe";

/**
 * Server-side Stripe client — NEVER import this in client components.
 * Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on the client.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});
