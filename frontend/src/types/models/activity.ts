// ─── Activity log domain model ───

export type ActivityLogAction =
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.cancelled"
  | "client.created"
  | "client.updated"
  | "recovery.started"
  | "recovery.action_sent"
  | "recovery.resolved"
  | "settings.updated";

export interface ActivityLog {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  action: ActivityLogAction;
  entityType: "invoice" | "client" | "recovery" | "settings";
  entityId: string;
  entityLabel: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
