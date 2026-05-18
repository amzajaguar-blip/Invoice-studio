// ─── Invoice Status ───────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid" | "cancelled";

export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  dot: string;
}

export const STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  paid: {
    label: "Pagata",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    dot: "#22c55e",
  },
  sent: {
    label: "Inviata",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    dot: "#f59e0b",
  },
  overdue: {
    label: "Scaduta",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    dot: "#ef4444",
  },
  draft: {
    label: "Bozza",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
    dot: "#6b7280",
  },
  cancelled: {
    label: "Annullata",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
    dot: "#6b7280",
  },
};

export const FALLBACK_META: StatusMeta = {
  label: "Sconosciuto",
  color: "#6b7280",
  bg: "rgba(107,114,128,0.12)",
  dot: "#6b7280",
};

// ─── Currency ─────────────────────────────────────────────────────────────────

export type Currency = "EUR" | "USD" | "GBP" | "CHF";

export const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF"];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr.",
};

// ─── Line Item ────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// ─── Invoice (matches Supabase DB columns — snake_case) ──────────────────────

export interface Invoice {
  id: string;
  org_id?: string;
  client_id?: string;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  withholding_tax_rate: number;
  total: number;
  currency: Currency;
  notes?: string | null;
  payment_link?: string | null;
  paid_at: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined relations (from Supabase queries)
  clients?: {
    id: string;
    name: string;
    email: string;
    vat_number?: string | null;
    address?: string | null;
    currency?: string;
    phone?: string | null;
    notes?: string | null;
  } | null;
  invoice_items?: Array<{
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
  invoice_events?: Array<{
    id: string;
    invoice_id: string;
    event_type: string;
    metadata?: Record<string, unknown> | null;
    created_at: string;
  }>;

  // Legacy prototype aliases (for backward compat with InvoiceStudio.jsx)
  client?: string;
  amount?: number;
  issued?: string;
  due?: string;
  paidAt?: string | null;
  opened?: boolean;
  items?: LineItem[];
  vatRate?: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  org_id?: string;
  name: string;
  email: string;
  vat_number?: string | null;
  address?: string | null;
  currency: string;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  // Legacy alias
  orgId?: string;
  vatNumber?: string;
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export interface KPICardProps {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  icon: string;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "agency" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  logo_url?: string | null;
  brand_color?: string | null;
  stripe_account_id?: string | null;
  plan: PlanTier;
  iban?: string | null;
  created_at?: string;
  updated_at?: string;

  // Legacy aliases
  logoUrl?: string;
  brandColor?: string;
  stripeAccountId?: string;
}
