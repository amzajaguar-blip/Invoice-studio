// ─── Invoice domain model ───

export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid" | "cancelled";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  withholdingTaxRate: number;
  total: number;
  currency: "EUR" | "USD" | "GBP" | "CHF";
  paymentLink: string | null;
  paidAt: string | null;
  notes: string | null;
  items: LineItem[];
  createdAt: string;
  updatedAt: string | null;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  eventType:
    | "created"
    | "sent"
    | "opened"
    | "paid"
    | "cancelled"
    | "reminder_sent"
    | "recovery_started"
    | "recovery_completed";
  metadata: Record<string, unknown>;
  createdAt: string;
}
