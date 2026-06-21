// ─── Analytics Repository interface ───
// NO API implementation. Mock only.

import type { RevenueTrend, CashflowForecast } from "@/types/models";
import type { ClientRevenue, RecoveryStats } from "@/types/states/analytics";

export interface AnalyticsRepository {
  /** Get revenue trend for a date range. */
  getRevenueTrend(
    orgId: string,
    monthsBack?: number,
  ): Promise<RevenueTrend>;

  /** Get cashflow forecast. */
  getCashflowForecast(
    orgId: string,
    monthsAhead?: number,
  ): Promise<CashflowForecast>;

  /** Get top clients by revenue. */
  getTopClients(
    orgId: string,
    limit?: number,
  ): Promise<ClientRevenue[]>;

  /** Get recovery performance stats. */
  getRecoveryStats(orgId: string): Promise<RecoveryStats>;
}
