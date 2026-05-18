import { createClient } from "@/lib/supabase/server";

/**
 * Inserts an audit log entry (server-side only).
 * Call this from API routes and server actions for GDPR compliance.
 */
export async function audit(params: {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const supabase = await createClient();
  return supabase.from("audit_logs").insert({
    org_id: params.orgId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    changes: params.changes ?? null,
    ip_address: params.ipAddress ?? null,
  });
}
