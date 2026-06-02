// ─── AI domain model ───

export type AiRecommendationType =
  | "recovery_timing"
  | "client_risk"
  | "pricing_suggestion"
  | "cashflow_alert"
  | "tax_reminder";

export type AiRecommendationPriority = "low" | "medium" | "high" | "critical";

export interface AiRecommendation {
  id: string;
  orgId: string;
  type: AiRecommendationType;
  priority: AiRecommendationPriority;
  title: string;
  description: string;
  actionLabel: string | null;
  actionRoute: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  dismissedAt: string | null;
}
