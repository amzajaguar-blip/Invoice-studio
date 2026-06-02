// ─── Invoice Repository — Mock implementation ───

import type {
  InvoiceRepository,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from "@/repositories/interfaces/invoice-repository";
import type { Invoice } from "@/types/models";

const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-1", orgId: "org-1", clientId: "c1", clientName: "Studio Legale Rossi",
    number: "2026-001", status: "paid", issueDate: "2026-05-01", dueDate: "2026-05-31",
    subtotal: 2500, taxRate: 0, withholdingTaxRate: 20, total: 2000,
    currency: "EUR", paymentLink: null, paidAt: "2026-05-15", notes: null,
    items: [{ id: "i1", description: "Consulenza legale", quantity: 1, unitPrice: 2500, taxRate: 0 }],
    createdAt: "2026-05-01T10:00:00Z", updatedAt: null,
  },
  {
    id: "inv-2", orgId: "org-1", clientId: "c2", clientName: "WebAgency Pro",
    number: "2026-002", status: "sent", issueDate: "2026-05-20", dueDate: "2026-06-20",
    subtotal: 1800, taxRate: 0, withholdingTaxRate: 20, total: 1440,
    currency: "EUR", paymentLink: "https://pay.example.com/inv-2", paidAt: null, notes: null,
    items: [{ id: "i2", description: "Restyling sito web", quantity: 1, unitPrice: 1800, taxRate: 0 }],
    createdAt: "2026-05-20T14:00:00Z", updatedAt: null,
  },
  {
    id: "inv-3", orgId: "org-1", clientId: "c3", clientName: "Mario Bianchi",
    number: "2026-003", status: "overdue", issueDate: "2026-04-01", dueDate: "2026-05-01",
    subtotal: 950, taxRate: 0, withholdingTaxRate: 20, total: 760,
    currency: "EUR", paymentLink: null, paidAt: null, notes: null,
    items: [{ id: "i3", description: "Copywriting landing page", quantity: 1, unitPrice: 950, taxRate: 0 }],
    createdAt: "2026-04-01T09:00:00Z", updatedAt: null,
  },
  {
    id: "inv-4", orgId: "org-1", clientId: "c1", clientName: "Studio Legale Rossi",
    number: "2026-004", status: "draft", issueDate: "2026-06-01", dueDate: "2026-07-01",
    subtotal: 1200, taxRate: 0, withholdingTaxRate: 20, total: 960,
    currency: "EUR", paymentLink: null, paidAt: null, notes: "Bozza — ritenuta d'acconto 20%",
    items: [{ id: "i4", description: "Redazione contratto", quantity: 1, unitPrice: 1200, taxRate: 0 }],
    createdAt: "2026-06-01T11:00:00Z", updatedAt: null,
  },
];

export function createInvoiceRepositoryMock(): InvoiceRepository {
  let invoices = [...MOCK_INVOICES];
  let nextNumber = 5;

  return {
    async list(
      _orgId: string,
      filter?: string,
      _page?: number,
      _pageSize?: number,
    ): Promise<{ invoices: Invoice[]; total: number; hasMore: boolean }> {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

      let filtered = invoices;
      if (filter && filter !== "all") {
        filtered = invoices.filter((i) => i.status === filter);
      }

      return {
        invoices: filtered,
        total: filtered.length,
        hasMore: false,
      };
    },

    async getById(invoiceId: string): Promise<Invoice | null> {
      await new Promise((r) => setTimeout(r, 200));
      return invoices.find((i) => i.id === invoiceId) ?? null;
    },

    async create(_orgId: string, input: CreateInvoiceInput): Promise<Invoice> {
      await new Promise((r) => setTimeout(r, 400));

      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const withholdingTaxRate = input.withholdingTaxRate ?? 20;
      const total = subtotal * (1 - withholdingTaxRate / 100);

      const invoice: Invoice = {
        id: `inv-${nextNumber++}`,
        orgId: _orgId,
        clientId: input.clientId,
        clientName: "Nuovo Cliente",
        number: input.number,
        status: "draft",
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        subtotal,
        taxRate: 0,
        withholdingTaxRate,
        total,
        currency: "EUR",
        paymentLink: null,
        paidAt: null,
        notes: input.notes ?? null,
        items: input.items.map((item, idx) => ({
          id: `i-${nextNumber}-${idx}`,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      invoices = [invoice, ...invoices];
      return invoice;
    },

    async update(invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice> {
      await new Promise((r) => setTimeout(r, 300));
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx === -1) throw new Error("Invoice not found");

      const existing = invoices[idx]!;
      let items = existing.items;
      let subtotal = existing.subtotal;
      let total = existing.total;

      if (input.items) {
        items = input.items.map((item, i) => ({
          id: `ui-${i}`,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0,
        }));
        subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const wr = input.withholdingTaxRate ?? existing.withholdingTaxRate;
        total = subtotal * (1 - wr / 100);
      }

      const updated: Invoice = {
        ...existing,
        clientId: input.clientId ?? existing.clientId,
        number: input.number ?? existing.number,
        issueDate: input.issueDate ?? existing.issueDate,
        dueDate: input.dueDate ?? existing.dueDate,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        withholdingTaxRate: input.withholdingTaxRate ?? existing.withholdingTaxRate,
        items,
        subtotal,
        total,
        updatedAt: new Date().toISOString(),
      };

      invoices[idx] = updated;
      return updated;
    },

    async delete(invoiceId: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 200));
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx === -1) return;
      invoices.splice(idx, 1);
    },

    async send(invoiceId: string): Promise<Invoice> {
      await new Promise((r) => setTimeout(r, 500));
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx === -1) throw new Error("Invoice not found");
      invoices[idx] = { ...invoices[idx]!, status: "sent", updatedAt: new Date().toISOString() };
      return invoices[idx]!;
    },

    async markPaid(invoiceId: string): Promise<Invoice> {
      await new Promise((r) => setTimeout(r, 300));
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx === -1) throw new Error("Invoice not found");
      invoices[idx] = {
        ...invoices[idx]!,
        status: "paid",
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return invoices[idx]!;
    },

    async cancel(invoiceId: string): Promise<Invoice> {
      await new Promise((r) => setTimeout(r, 300));
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx === -1) throw new Error("Invoice not found");
      invoices[idx] = { ...invoices[idx]!, status: "cancelled", updatedAt: new Date().toISOString() };
      return invoices[idx]!;
    },
  };
}
