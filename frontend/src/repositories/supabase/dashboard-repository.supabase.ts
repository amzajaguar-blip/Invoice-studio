// ─── Dashboard Repository — Supabase implementation ───
// Real data fetching. Swap this in when ready for production.

import type { DashboardRepository } from "@/repositories/interfaces/dashboard-repository";
import type { DashboardData, DashboardKpi } from "@/types/states/dashboard";
import { fromSupabaseInvoice } from "@/lib/mappers";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createDashboardRepositorySupabase(
  supabase: SupabaseClient<Database>,
  orgId: string,
): DashboardRepository {
  return {
    async getDashboardData(_orgId: string): Promise<DashboardData> {
      // Fetch invoices with joined relations
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*, clients(*), invoice_items(*), invoice_events(*)")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Fetch client count
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      const invoiceList = (invoices ?? []).map(fromSupabaseInvoice);

      // Compute KPIs
      const paidInvoices = invoiceList.filter((i) => i.status === "paid");
      const pendingInvoices = invoiceList.filter(
        (i) => i.status === "sent" || i.status === "overdue",
      );
      const overdueInvoices = invoiceList.filter((i) => i.status === "overdue");
      const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);
      const totalOutstanding = pendingInvoices.reduce((s, i) => s + i.total, 0);

      const kpis: DashboardKpi[] = [
        {
          label: "Incassato",
          value: formatEur(totalRevenue),
          sub: `${paidInvoices.length} fatture pagate`,
          accent: totalRevenue > 0 ? "positive" : "neutral",
          icon: "revenue",
        },
        {
          label: "In attesa",
          value: formatEur(totalOutstanding),
          sub: `${pendingInvoices.length} fatture aperte`,
          accent: totalOutstanding > 0 ? "negative" : "neutral",
          icon: "pending",
        },
        {
          label: "Scadute",
          value: String(overdueInvoices.length),
          sub: overdueInvoices.length === 1 ? "1 fattura scaduta" : `${overdueInvoices.length} fatture scadute`,
          accent: overdueInvoices.length > 0 ? "negative" : "neutral",
          icon: "recovery",
        },
        {
          label: "Clienti",
          value: String(clientCount ?? 0),
          sub: (clientCount ?? 0) === 1 ? "1 cliente" : `${clientCount ?? 0} clienti`,
          accent: "neutral",
          icon: "clients",
        },
      ];

      // Build revenue trend from invoice data
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toISOString().slice(0, 7);
        const total = invoiceList
          .filter(
            (inv) =>
              inv.status === "paid" &&
              inv.paidAt?.startsWith(monthKey),
          )
          .reduce((s, inv) => s + inv.total, 0);
        const count = invoiceList.filter(
          (inv) => inv.createdAt.startsWith(monthKey),
        ).length;
        const paid = invoiceList.filter(
          (inv) => inv.paidAt?.startsWith(monthKey),
        ).length;

        months.push({
          month: d.toISOString(),
          revenue: total,
          invoiceCount: count,
          paidCount: paid,
          averagePaymentDays: 14,
        });
      }

      const trend = months.length >= 2 && months[months.length - 1]!.revenue > months[months.length - 2]!.revenue
        ? "up"
        : months.length >= 2 && months[months.length - 1]!.revenue < months[months.length - 2]!.revenue
          ? "down"
          : "stable";

      const growthRate =
        months.length >= 2 && months[months.length - 2]!.revenue > 0
          ? Math.round(
              ((months[months.length - 1]!.revenue - months[months.length - 2]!.revenue) /
                months[months.length - 2]!.revenue) *
                100,
            )
          : 0;

      return {
        kpis,
        recentInvoices: invoiceList.slice(0, 5),
        revenueTrend: { months, trend: trend as "up" | "down" | "stable", growthRate },
        cashflowForecast: null,
        recommendations: [],
        activeRecoveries: overdueInvoices.length,
      };
    },

    async refreshKpis(_orgId: string): Promise<DashboardData["kpis"]> {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, status, total")
        .eq("org_id", orgId)
        .is("deleted_at", null);
      // ── Explicit cast: supabase partial select returns loose types ──
      type RefreshRow = { status: string; total: number };

      const list = (invoices ?? []) as RefreshRow[];
      const paid = list.filter((i) => i.status === "paid");
      const pending = list.filter((i) => i.status === "sent" || i.status === "overdue");
      const overdue = list.filter((i) => i.status === "overdue");

      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      return [
        {
          label: "Incassato",
          value: formatEur(paid.reduce((s, i) => s + i.total, 0)),
          sub: `${paid.length} fatture pagate`,
          accent: paid.length > 0 ? "positive" : "neutral",
          icon: "revenue",
        },
        {
          label: "In attesa",
          value: formatEur(pending.reduce((s, i) => s + i.total, 0)),
          sub: `${pending.length} fatture aperte`,
          accent: pending.length > 0 ? "negative" : "neutral",
          icon: "pending",
        },
        {
          label: "Scadute",
          value: String(overdue.length),
          sub: overdue.length === 1 ? "1 fattura scaduta" : `${overdue.length} fatture scadute`,
          accent: overdue.length > 0 ? "negative" : "neutral",
          icon: "recovery",
        },
        {
          label: "Clienti",
          value: String(count ?? 0),
          sub: (count ?? 0) === 1 ? "1 cliente" : `${count ?? 0} clienti`,
          accent: "neutral",
          icon: "clients",
        },
      ];
    },
  };
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}
