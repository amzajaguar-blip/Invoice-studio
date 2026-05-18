import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin client — bypasses Row Level Security.
 * ONLY use in API routes that need to operate across tenants
 * (e.g., Stripe webhooks, scheduled jobs).
 * Protected by "server-only" — will throw at build time if imported in client code.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from the browser");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
