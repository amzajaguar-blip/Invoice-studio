// ─── Invoice Repository interface ───
// NO API implementation. Mock only.

import type { Invoice, InvoiceStatus } from "@/types/models";

export interface InvoiceRepository {
  /** List invoices with optional filter and pagination. */
  list(
    orgId: string,
    filter?: InvoiceStatus | "all",
    page?: number,
    pageSize?: number,
  ): Promise<{ invoices: Invoice[]; total: number; hasMore: boolean }>;

  /** Get a single invoice by ID. */
  getById(invoiceId: string): Promise<Invoice | null>;

  /** Create a new draft invoice. */
  create(orgId: string, input: CreateInvoiceInput): Promise<Invoice>;

  /** Update an existing invoice (draft only). */
  update(invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice>;

  /** Delete an invoice (draft only). */
  delete(invoiceId: string): Promise<void>;

  /** Send an invoice to the client. */
  send(invoiceId: string): Promise<Invoice>;

  /** Mark an invoice as paid. */
  markPaid(invoiceId: string): Promise<Invoice>;

  /** Cancel an invoice. */
  cancel(invoiceId: string): Promise<Invoice>;
}

export interface CreateInvoiceInput {
  clientId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: number; unitPrice: number; taxRate?: number }[];
  notes?: string;
  withholdingTaxRate?: number;
}

export interface UpdateInvoiceInput {
  clientId?: string;
  number?: string;
  issueDate?: string;
  dueDate?: string;
  items?: { description: string; quantity: number; unitPrice: number; taxRate?: number }[];
  notes?: string;
  withholdingTaxRate?: number;
}
