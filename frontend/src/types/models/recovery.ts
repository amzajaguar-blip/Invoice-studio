// ─── Recovery domain model ───
// "Recovery" replaces the legacy "Dunning" terminology throughout the app.
// Represents the structured process of collecting overdue invoice payments.

export type RecoveryStage =
  | "pending"
  | "reminder_1"
  | "reminder_2"
  | "final_notice"
  | "escalated"
  | "resolved"
  | "cancelled";

export interface RecoveryCampaign {
  id: string;
  orgId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: "EUR" | "USD" | "GBP" | "CHF";
  currentStage: RecoveryStage;
  startedAt: string;
  nextActionAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
}

export interface RecoveryAction {
  id: string;
  campaignId: string;
  stage: RecoveryStage;
  actionType: "email" | "sms" | "whatsapp" | "manual";
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  error: string | null;
}

export const RECOVERY_STAGE_LABELS: Record<RecoveryStage, string> = {
  pending: "In attesa",
  reminder_1: "Primo sollecito",
  reminder_2: "Secondo sollecito",
  final_notice: "Avviso finale",
  escalated: "Escalation",
  resolved: "Risolto",
  cancelled: "Annullato",
};
