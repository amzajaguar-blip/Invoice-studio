import Stripe from "stripe";

/**
 * Lazy-initialized Stripe client — defers `new Stripe()` to runtime
 * (first property access) so the build phase doesn't need STRIPE_SECRET_KEY.
 *
 * Server-side only — NEVER import this in client components.
 * Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on the client.
 */
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
