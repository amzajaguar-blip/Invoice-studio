// ─── Dashboard Repository interface ───
// NO API implementation. Mock only.

import type { DashboardData } from "@/types/states/dashboard";

export interface DashboardRepository {
  getDashboardData(orgId: string): Promise<DashboardData>;
  /** Refresh after an invoice change — smart partial refetch. */
  refreshKpis(orgId: string): Promise<DashboardData["kpis"]>;
}
