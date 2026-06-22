// ─── Analytics Repository — Mock implementation ───

import type { AnalyticsRepository } from "@/repositories/interfaces/analytics-repository";
import type { RevenueTrend, CashflowForecast } from "@/types/models";
import type { ClientRevenue, RecoveryStats } from "@/types/states/analytics";

export function createAnalyticsRepositoryMock(): AnalyticsRepository {
  return {
    async getRevenueTrend(_orgId: string, _monthsBack?: number): Promise<RevenueTrend> {
      await new Promise((r) => setTimeout(r, 500));
      return {
        months: [
          { month: "2026-01-01", revenue: 3200, invoiceCount: 8, paidCount: 7, averagePaymentDays: 18 },
          { month: "2026-02-01", revenue: 2800, invoiceCount: 7, paidCount: 6, averagePaymentDays: 21 },
          { month: "2026-03-01", revenue: 4100, invoiceCount: 10, paidCount: 9, averagePaymentDays: 15 },
          { month: "2026-04-01", revenue: 3800, invoiceCount: 9, paidCount: 8, averagePaymentDays: 19 },
          { month: "2026-05-01", revenue: 4250, invoiceCount: 12, paidCount: 9, averagePaymentDays: 14 },
        ],
        trend: "up",
        growthRate: 12,
      };
    },

    async getCashflowForecast(_orgId: string, _monthsAhead?: number): Promise<CashflowForecast> {
      await new Promise((r) => setTimeout(r, 600));
      return {
        period: "2026-06",
        projectedRevenue: 4800,
        projectedExpenses: 600,
        netProjection: 4200,
        confidence: 0.78,
        breakdown: [
          { category: "invoices", amount: 3800, label: "Fatture attive" },
          { category: "recurring", amount: 600, label: "Contratti ricorrenti" },
          { category: "recovery", amount: 400, label: "Recupero crediti" },
          { category: "expenses", amount: 600, label: "Spese previste" },
        ],
      };
    },

    async getTopClients(_orgId: string, _limit?: number): Promise<ClientRevenue[]> {
      await new Promise((r) => setTimeout(r, 400));
      return [
        { clientId: "c1", clientName: "Studio Legale Rossi", totalRevenue: 8500, invoiceCount: 4, averagePaymentDays: 12 },
        { clientId: "c2", clientName: "WebAgency Pro", totalRevenue: 5400, invoiceCount: 3, averagePaymentDays: 20 },
        { clientId: "c3", clientName: "Mario Bianchi", totalRevenue: 2850, invoiceCount: 3, averagePaymentDays: 35 },
      ];
    },

    async getRecoveryStats(_orgId: string): Promise<RecoveryStats> {
      await new Promise((r) => setTimeout(r, 350));
      return {
        totalCampaigns: 8,
        activeCampaigns: 2,
        resolvedCampaigns: 6,
        recoveryRate: 75,
        averageResolutionDays: 18,
      };
    },
  };
}
