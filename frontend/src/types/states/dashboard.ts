// ─── Dashboard UiState ───

import type { UiState } from "./base";
import type { AiRecommendation, CashflowForecast, Invoice, RevenueTrend } from "../models";

export interface DashboardData {
  /** KPI summary cards. */
  kpis: DashboardKpi[];
  /** Upcoming or recent invoices. */
  recentInvoices: Invoice[];
  /** Revenue trend for chart. */
  revenueTrend: RevenueTrend | null;
  /** Cashflow forecast if available. */
  cashflowForecast: CashflowForecast | null;
  /** AI-powered recommendations. */
  recommendations: AiRecommendation[];
  /** Active recovery campaigns count. */
  activeRecoveries: number;
}

export interface DashboardKpi {
  label: string;
  value: string;
  sub: string;
  accent: "positive" | "negative" | "neutral";
  icon: "revenue" | "invoices" | "clients" | "recovery" | "pending";
}

export type DashboardUiState = UiState<DashboardData>;
