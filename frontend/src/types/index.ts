// ─── @/types compatibility layer ───
// Re-exports from canonical types/models/ with backward-compatible aliases.
// All new code should import from @/types/models directly.
// This file exists only to support 10 legacy consumers during the transition.

// ─── Re-export canonical models (snake_case aliases dropped — use models/) ───

import type { Invoice as ModelInvoice, InvoiceStatus as ModelInvoiceStatus, LineItem as ModelLineItem } from "./models/invoice";
import type { Client as ModelClient } from "./models/client";
import type { Organization as ModelOrganization, PlanTier as ModelPlanTier } from "./models/organization";

// ─── Invoice Status (unchanged) ───

export type InvoiceStatus = ModelInvoiceStatus;

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

// ─── Currency ───

export type Currency = "EUR" | "USD" | "GBP" | "CHF";

export const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF"];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr.",
};

// ─── LineItem ───

export type LineItem = ModelLineItem;

// ─── Invoice (backward-compatible — delegates to canonical model) ───

export type Invoice = ModelInvoice & {
  // Legacy snake_case aliases for backward compat
  org_id?: string;
  client_id?: string;
  issue_date?: string;
  due_date?: string;
  tax_rate?: number;
  withholding_tax_rate?: number;
  payment_link?: string | null;
  paid_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined relations
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

  // Legacy prototype aliases
  client?: string;
  amount?: number;
  issued?: string;
  due?: string;
  paidAt?: string | null;
  opened?: boolean;
  items?: LineItem[];
  vatRate?: number;
};

// ─── Client (backward-compatible) ───

export type Client = ModelClient & {
  org_id?: string;
  vat_number?: string | null;
  created_at?: string;
  updated_at?: string;
  orgId?: string;
  vatNumber?: string;
};

// ─── KPI ───

export interface KPICardProps {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  icon: string;
}

// ─── Organization (backward-compatible) ───

export type PlanTier = ModelPlanTier;

export type Organization = ModelOrganization & {
  logo_url?: string | null;
  brand_color?: string | null;
  stripe_account_id?: string | null;
  created_at?: string;
  updated_at?: string;
  logoUrl?: string;
  brandColor?: string;
  stripeAccountId?: string;
};
