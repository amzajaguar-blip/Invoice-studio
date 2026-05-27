/**
 * Analytics helpers — no external libraries required.
 * All calculations done locally from the invoices array.
 */

export interface MonthlyRevenue {
  month: string; // "Gen", "Feb", …
  total: number;
}

export interface CashflowPrediction {
  expectedNext30Days: number;
  confidence: "high" | "medium" | "low";
  pendingInvoices: number;
  avgMonthlyRevenue: number;
}

/**
 * Returns last N months of total paid revenue as { month, total }[].
 */
export function getMonthlyRevenueTrend(
  invoices: any[],
  months = 6
): MonthlyRevenue[] {
  const result: MonthlyRevenue[] = [];
  const now = new Date();

  const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();

    const total = invoices
      .filter((inv: any) => {
        if (inv.status !== "paid" || !inv.paid_at) return false;
        const paid = new Date(inv.paid_at);
        return paid.getFullYear() === year && paid.getMonth() === month;
      })
      .reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0);

    result.push({ month: monthLabels[month], total });
  }

  return result;
}

/**
 * Predicts expected cash inflow over the next 30 days
 * based on: open invoices due within 30 days + average monthly trend.
 */
export function predictCashflow(invoices: any[]): CashflowPrediction {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Pending invoices due in the next 30 days
  const pending = invoices.filter((inv: any) => {
    if (inv.status !== "sent") return false;
    const due = new Date(inv.due_date ?? inv.dueDate ?? 0);
    return due >= now && due <= in30;
  });
  const pendingTotal = pending.reduce((s: number, inv: any) => s + (inv.total ?? 0), 0);

  // Average paid revenue over last 3 months
  const trend = getMonthlyRevenueTrend(invoices, 3);
  const paid = trend.map((t) => t.total);
  const avgPaid = paid.length > 0 ? paid.reduce((a, b) => a + b, 0) / paid.length : 0;

  // Confidence based on data volume
  const dataPoints = invoices.filter((inv: any) => inv.status === "paid").length;
  const confidence: "high" | "medium" | "low" =
    dataPoints >= 20 ? "high" : dataPoints >= 5 ? "medium" : "low";

  // Blend: 60% pending invoices + 40% avg monthly trend
  const expected = pendingTotal * 0.6 + avgPaid * 0.4;

  return {
    expectedNext30Days: Math.round(expected * 100) / 100,
    confidence,
    pendingInvoices: pending.length,
    avgMonthlyRevenue: Math.round(avgPaid * 100) / 100,
  };
}
