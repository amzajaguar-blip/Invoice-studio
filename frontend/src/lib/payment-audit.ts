import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PCI-DSS Compliant payment audit logger.
 *
 * IMPORTANT: Never log:
 *  - Full card numbers, CVV, expiry dates
 *  - Raw webhook body payloads
 *  - Stripe secret keys or client secrets
 *
 * Only log: event type, internal IDs, timestamp, environment.
 */
export interface PaymentAuditEntry {
  event_type: string;          // e.g. "stripe.checkout.completed"
  provider: "stripe" | "revenuecat";
  invoice_id?: string;
  org_id?: string;
  external_event_id?: string;  // stripe event id or RC transaction id
  environment: "sandbox" | "production" | "unknown";
  outcome: "success" | "failure" | "ignored";
  error_code?: string;         // short code only, never raw error message with PII
}

/**
 * Insert a payment audit log entry.
 * Uses admin client to ensure it is always written, even if RLS would block.
 * Non-fatal — errors are logged but not propagated.
 */
export async function logPaymentAudit(entry: PaymentAuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("payment_audit_logs").insert({
      event_type: entry.event_type,
      provider: entry.provider,
      invoice_id: entry.invoice_id ?? null,
      org_id: entry.org_id ?? null,
      external_event_id: entry.external_event_id ?? null,
      environment: entry.environment,
      outcome: entry.outcome,
      error_code: entry.error_code ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Non-fatal — audit failure must never break business logic
      console.error("[payment-audit] DB write failed:", error.code, error.hint);
    }
  } catch (err) {
    console.error("[payment-audit] Unexpected error:", (err as Error).message);
  }
}
