// ─── Analytics UiState ───

import type { UiState } from "./base";
import type { RevenueTrend, CashflowForecast } from "../models";

export interface AnalyticsData {
  revenueTrend: RevenueTrend;
  cashflowForecast: CashflowForecast | null;
  /** Top N clients by revenue. */
  topClients: ClientRevenue[];
  /** Recovery performance stats. */
  recoveryStats: RecoveryStats;
}

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
  averagePaymentDays: number;
}

export interface RecoveryStats {
  totalCampaigns: number;
  activeCampaigns: number;
  resolvedCampaigns: number;
  recoveryRate: number; // percentage
  averageResolutionDays: number;
}

export type AnalyticsUiState = UiState<AnalyticsData>;
