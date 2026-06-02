// ─── Analytics Repository — Supabase implementation ───

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AnalyticsRepository } from "@/repositories/interfaces/analytics-repository";
import type { MonthlyRevenue, RevenueTrend, CashflowForecast } from "@/types/models";
import type { ClientRevenue, RecoveryStats } from "@/types/states/analytics";

export function createAnalyticsRepositorySupabase(
  supabase: SupabaseClient<Database>,
  orgId: string,
): AnalyticsRepository {
  type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

  async function fetchInvoicesForPeriod(monthsBack: number): Promise<InvoiceRow[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const sinceStr = since.toISOString().split("T")[0]!;

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .gte("created_at", sinceStr);

    if (error) throw new Error(error.message);
    return (data ?? []) as InvoiceRow[];
  }

  return {
    async getRevenueTrend(_orgId: string, monthsBack = 12): Promise<RevenueTrend> {
      const invoices = await fetchInvoicesForPeriod(monthsBack);

      const now = new Date();
      const months: MonthlyRevenue[] = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const monthInvoices = invoices.filter(
          (inv) => inv.created_at.startsWith(key),
        );
        const paid = monthInvoices.filter((inv) => inv.status === "paid");
        const revenue = paid.reduce((s, inv) => s + inv.total, 0);
        const avgDays =
          paid.length > 0
            ? paid.reduce((s, inv) => {
                if (!inv.paid_at) return s;
                const issue = new Date(inv.issue_date).getTime();
                const payment = new Date(inv.paid_at).getTime();
                return s + (payment - issue) / (1000 * 60 * 60 * 24);
              }, 0) / paid.length
            : 0;

        months.push({
          month: d.toISOString(),
          revenue,
          invoiceCount: monthInvoices.length,
          paidCount: paid.length,
          averagePaymentDays: Math.round(avgDays),
        });
      }

      const last = months[months.length - 1]!;
      const prev = months.length >= 2 ? months[months.length - 2]! : null;
      const trend =
        prev && last.revenue > prev.revenue ? "up"
        : prev && last.revenue < prev.revenue ? "down"
        : "stable";
      const growthRate =
        prev && prev.revenue > 0
          ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100)
          : 0;

      return { months, trend: trend as "up" | "down" | "stable", growthRate };
    },

    async getCashflowForecast(_orgId: string, monthsAhead = 3): Promise<CashflowForecast> {
      const invoices = await fetchInvoicesForPeriod(6);

      // Simple forecast: average monthly revenue × months ahead
      const paid = invoices.filter((i) => i.status === "paid");
      const totalPaid = paid.reduce((s, i) => s + i.total, 0);

      const activeMonthCount = new Set(
        invoices.map((i) => i.created_at.slice(0, 7)),
      ).size || 1;
      const avgMonthly = totalPaid / activeMonthCount;
      const projectedRevenue = Math.round(avgMonthly * monthsAhead);

      // Unpaid invoices as "expected"
      const unpaid = invoices.filter(
        (i) => i.status === "sent" || i.status === "overdue",
      );
      const expectedFromOpen = unpaid.reduce((s, i) => s + i.total, 0);

      return {
        period: new Date().toISOString().slice(0, 7),
        projectedRevenue: projectedRevenue + expectedFromOpen,
        projectedExpenses: 0,
        netProjection: projectedRevenue + expectedFromOpen,
        confidence: Math.min(0.9, activeMonthCount / 6),
        breakdown: [
          { category: "invoices", amount: projectedRevenue, label: "Media mensile" },
          { category: "recovery", amount: expectedFromOpen, label: "Fatture aperte" },
          { category: "recurring", amount: 0, label: "Ricorrenti" },
          { category: "expenses", amount: 0, label: "Spese" },
        ],
      };
    },

    async getTopClients(_orgId: string, limit = 10): Promise<ClientRevenue[]> {
      const { data, error } = await supabase
        .from("invoices")
        .select("client_id, clients(name), total, status, paid_at, issue_date")
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) throw new Error(error.message);
      type TopClientRow = { client_id: string; clients: { name: string } | null; total: number; status: string; paid_at: string | null; issue_date: string };
      const invoices = (data ?? []) as TopClientRow[];

      const byClient = new Map<string, { name: string; total: number; count: number; paymentDays: number[] }>();

      for (const inv of invoices) {
        const cid = inv.client_id;
        const existing = byClient.get(cid) ?? { name: inv.clients?.name ?? "Sconosciuto", total: 0, count: 0, paymentDays: [] };
        existing.total += inv.total;
        if (inv.status === "paid") {
          existing.count++;
          if (inv.paid_at) {
            const days = (new Date(inv.paid_at).getTime() - new Date(inv.issue_date).getTime()) / (1000 * 60 * 60 * 24);
            existing.paymentDays.push(days);
          }
        }
        byClient.set(cid, existing);
      }

      return Array.from(byClient.entries())
        .map(([clientId, d]) => ({
          clientId,
          clientName: d.name,
          totalRevenue: d.total,
          invoiceCount: d.count,
          averagePaymentDays:
            d.paymentDays.length > 0
              ? Math.round(d.paymentDays.reduce((a, b) => a + b, 0) / d.paymentDays.length)
              : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
    },

    async getRecoveryStats(_orgId: string): Promise<RecoveryStats> {
      const { data, error } = await supabase
        .from("invoices")
        .select("status, total")
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) throw new Error(error.message);
      type RecoveryRow = { status: string; total: number };
      const invoices = (data ?? []) as RecoveryRow[];

      const overdue = invoices.filter((i) => i.status === "overdue");
      const paid = invoices.filter((i) => i.status === "paid");

      return {
        totalCampaigns: overdue.length + paid.length,
        activeCampaigns: overdue.length,
        resolvedCampaigns: paid.length,
        recoveryRate:
          overdue.length + paid.length > 0
            ? Math.round((paid.length / (overdue.length + paid.length)) * 100)
            : 0,
        averageResolutionDays: 18, // placeholder — would need recovery_campaigns table
      };
    },
  };
}
