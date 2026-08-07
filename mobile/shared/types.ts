// Invoice Studio - Shared Types

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number; // quantity * rate
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: Client;
  clientSnapshot?: ClientSnapshot;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number; // percentage
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
  attachments?: string[]; // file paths or URLs
  paidDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  logo?: string; // base64 or file path
  currency: string;
  defaultTaxRate: number;
  defaultPaymentTerms: string;
}

export interface AppSettings {
  businessInfo: BusinessInfo;
  theme: 'light' | 'dark' | 'auto';
  invoicePrefix: string;
  nextInvoiceNumber: number;
  currency: string;
}

export interface ShareOptions {
  method: 'email' | 'whatsapp' | 'sms' | 'link' | 'print' | 'save';
  includeAttachment?: boolean;
  customMessage?: string;
}

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string;
  role: 'user' | 'admin';
  lastSignedIn: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// VELA Pivot — Nuovi tipi condivisi (aggiunti in append, nessun tipo esistente modificato)
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'invoiced';

export type ReminderRecurrence = 'once' | 'monthly' | 'yearly';

export interface ClientSnapshot {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  currency: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
  clientId?: string;
  clientSnapshot: ClientSnapshot;
  lineItems: LineItem[]; // riusa LineItem esistente
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  templateId?: string;
  convertedToInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseItem {
  id: string;
  date: Date;
  category: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface ExpenseReport {
  id: string;
  reportNumber: string;
  title: string;
  periodFrom: Date;
  periodTo: Date;
  items: ExpenseItem[];
  totalByCategory: Record<string, number>;
  grandTotal: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueDate: Date;
  recurrence: ReminderRecurrence;
  notificationId?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
