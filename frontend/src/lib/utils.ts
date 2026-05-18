import type { Currency, Invoice } from "@/types";

// ─── Currency Formatting ──────────────────────────────────────────────────────

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency: Currency = "EUR"): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86_400_000;
  if (Number.isNaN(diff)) return "—";
  if (diff < 0) return `${Math.abs(Math.round(diff))}gg fa`;
  return `${Math.round(diff)}gg`;
}

export function formatItalianDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Invoice Computation ─────────────────────────────────────────────────────

export function computeInvoiceTotals(invoice: Invoice) {
  if (!invoice.items || invoice.items.length === 0) {
    return { subtotal: 0, vat: 0, total: invoice.amount };
  }
  const vatRate = invoice.vatRate ?? 22;
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const vat = subtotal * (vatRate / 100);
  return { subtotal, vat, total: subtotal + vat };
}

// ─── Revenue by Month ─────────────────────────────────────────────────────────

export interface MonthlyDatum {
  month: string;
  yearMonth: string;
  revenue: number;
}

export function computeMonthlyRevenue(
  invoices: Invoice[],
  monthsBack: number = 7
): MonthlyDatum[] {
  const now = new Date();
  const months: MonthlyDatum[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: d.toLocaleDateString("it-IT", { month: "short" }),
      yearMonth: d.toISOString().slice(0, 7),
      revenue: 0,
    });
  }

  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paid_at) {
      const monthKey = inv.paid_at.slice(0, 7);
      const entry = months.find((m) => m.yearMonth === monthKey);
      if (entry) entry.revenue += (inv.total || inv.amount || 0);
    }
  }

  return months;
}

// ─── ID Generation ────────────────────────────────────────────────────────────

export function generateTempId(): string {
  return `temp-${crypto.randomUUID()}`;
}
