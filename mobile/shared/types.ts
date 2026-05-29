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
