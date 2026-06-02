// ─── Cashflow domain model ───

export interface CashflowForecast {
  period: string; // ISO month key e.g. "2026-06"
  projectedRevenue: number;
  projectedExpenses: number;
  netProjection: number;
  confidence: number; // 0–1
  breakdown: CashflowBreakdownItem[];
}

export interface CashflowBreakdownItem {
  category: "invoices" | "recurring" | "recovery" | "expenses";
  amount: number;
  label: string;
}

export interface MonthlyRevenue {
  month: string; // ISO date string, first day of month
  revenue: number;
  invoiceCount: number;
  paidCount: number;
  averagePaymentDays: number;
}

export interface RevenueTrend {
  months: MonthlyRevenue[];
  trend: "up" | "down" | "stable";
  growthRate: number; // percentage
}
