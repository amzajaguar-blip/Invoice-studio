// ─── Domain models barrel ───

export type { User, UserRole } from "./user";
export type {
  Organization,
  OrganizationSettings,
  PlanTier,
} from "./organization";
export type { Client } from "./client";
export type {
  Invoice,
  InvoiceStatus,
  InvoiceEvent,
  LineItem,
} from "./invoice";
export type {
  RecoveryCampaign,
  RecoveryAction,
  RecoveryStage,
} from "./recovery";
export { RECOVERY_STAGE_LABELS } from "./recovery";
export type {
  CashflowForecast,
  CashflowBreakdownItem,
  MonthlyRevenue,
  RevenueTrend,
} from "./cashflow";
export type {
  AiRecommendation,
  AiRecommendationType,
  AiRecommendationPriority,
} from "./ai";
export type { ActivityLog, ActivityLogAction } from "./activity";
export type { Signature, SignatureType, SignaturePosition } from "./signature";
export type {
  InvoiceTemplate,
  TemplateLayout,
  TemplateColorScheme,
  InvoiceCustomField,
} from "./invoice-template";
