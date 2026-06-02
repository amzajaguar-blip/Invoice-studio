// ─── Dashboard Repository — Mock implementation ───

import type { DashboardRepository } from "@/repositories/interfaces/dashboard-repository";
import type { DashboardData, DashboardKpi } from "@/types/states/dashboard";

const MOCK_KPIS: DashboardKpi[] = [
  { label: "Fatturato mensile", value: "€ 4.250", sub: "+12% vs mese scorso", accent: "positive", icon: "revenue" },
  { label: "Fatture emesse", value: "12", sub: "3 in attesa di pagamento", accent: "neutral", icon: "invoices" },
  { label: "Clienti attivi", value: "8", sub: "+2 questo mese", accent: "positive", icon: "clients" },
  { label: "Recuperi attivi", value: "2", sub: "Totale € 1.800 in recupero", accent: "negative", icon: "recovery" },
];

const MOCK_RECENT_INVOICES = [
  {
    id: "inv-1", orgId: "org-1", clientId: "c1", clientName: "Studio Legale Rossi",
    number: "2026-001", status: "paid" as const, issueDate: "2026-05-01", dueDate: "2026-05-31",
    subtotal: 2500, taxRate: 0, withholdingTaxRate: 20, total: 2000,
    currency: "EUR" as const, paymentLink: null, paidAt: "2026-05-15", notes: null,
    items: [{ id: "i1", description: "Consulenza legale", quantity: 1, unitPrice: 2500, taxRate: 0 }],
    createdAt: "2026-05-01", updatedAt: null,
  },
  {
    id: "inv-2", orgId: "org-1", clientId: "c2", clientName: "WebAgency Pro",
    number: "2026-002", status: "sent" as const, issueDate: "2026-05-20", dueDate: "2026-06-20",
    subtotal: 1800, taxRate: 0, withholdingTaxRate: 20, total: 1440,
    currency: "EUR" as const, paymentLink: "https://pay.example.com/inv-2", paidAt: null, notes: null,
    items: [{ id: "i2", description: "Restyling sito web", quantity: 1, unitPrice: 1800, taxRate: 0 }],
    createdAt: "2026-05-20", updatedAt: null,
  },
  {
    id: "inv-3", orgId: "org-1", clientId: "c3", clientName: "Mario Bianchi",
    number: "2026-003", status: "overdue" as const, issueDate: "2026-04-01", dueDate: "2026-05-01",
    subtotal: 950, taxRate: 0, withholdingTaxRate: 20, total: 760,
    currency: "EUR" as const, paymentLink: null, paidAt: null, notes: null,
    items: [{ id: "i3", description: "Copywriting landing page", quantity: 1, unitPrice: 950, taxRate: 0 }],
    createdAt: "2026-04-01", updatedAt: null,
  },
];

export function createDashboardRepositoryMock(): DashboardRepository {
  return {
    async getDashboardData(_orgId: string): Promise<DashboardData> {
      // Simulate network delay (300–800ms)
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

      return {
        kpis: MOCK_KPIS,
        recentInvoices: MOCK_RECENT_INVOICES,
        revenueTrend: {
          months: [
            { month: "2026-01-01", revenue: 3200, invoiceCount: 8, paidCount: 7, averagePaymentDays: 18 },
            { month: "2026-02-01", revenue: 2800, invoiceCount: 7, paidCount: 6, averagePaymentDays: 21 },
            { month: "2026-03-01", revenue: 4100, invoiceCount: 10, paidCount: 9, averagePaymentDays: 15 },
            { month: "2026-04-01", revenue: 3800, invoiceCount: 9, paidCount: 8, averagePaymentDays: 19 },
            { month: "2026-05-01", revenue: 4250, invoiceCount: 12, paidCount: 9, averagePaymentDays: 14 },
          ],
          trend: "up",
          growthRate: 12,
        },
        cashflowForecast: {
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
        },
        recommendations: [
          {
            id: "rec-1",
            orgId: "org-1",
            type: "recovery_timing",
            priority: "high",
            title: "Invia sollecito a Mario Bianchi",
            description: "La fattura #2026-003 è in ritardo di 30 giorni. Un sollecito ora aumenta le probabilità di recupero del 60%.",
            actionLabel: "Invia sollecito",
            actionRoute: "/invoices/inv-3",
            metadata: { invoiceId: "inv-3" },
            createdAt: "2026-06-01T10:00:00Z",
            dismissedAt: null,
          },
          {
            id: "rec-2",
            orgId: "org-1",
            type: "client_risk",
            priority: "medium",
            title: "WebAgency Pro: abitudini di pagamento",
            description: "Questo cliente paga in media con 5 giorni di ritardo. Considera di accorciare i termini a 15 giorni.",
            actionLabel: "Vedi dettagli",
            actionRoute: "/clients/c2",
            metadata: { clientId: "c2" },
            createdAt: "2026-06-01T08:00:00Z",
            dismissedAt: null,
          },
        ],
        activeRecoveries: 2,
      };
    },

    async refreshKpis(_orgId: string): Promise<DashboardData["kpis"]> {
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_KPIS;
    },
  };
}
