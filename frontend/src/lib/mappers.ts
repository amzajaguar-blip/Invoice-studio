// ─── Supabase DTO Mappers ───
// Converts snake_case DB rows → camelCase domain models.
// Single source of truth for all DB ↔ domain transformations.

import type { Invoice, LineItem, InvoiceEvent, InvoiceStatus } from "@/types/models/invoice";
import type { Client } from "@/types/models/client";
import type { Organization } from "@/types/models/organization";
import type { Database } from "@/types/database";

// ─── Invoice ───

type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbInvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
type DbInvoiceEvent = Database["public"]["Tables"]["invoice_events"]["Row"];
type DbClient = Database["public"]["Tables"]["clients"]["Row"];

export interface JoinedInvoiceRow extends DbInvoice {
  clients?: DbClient | null;
  invoice_items?: DbInvoiceItem[];
  invoice_events?: DbInvoiceEvent[];
}

/** Map a Supabase invoice row (with optional joined relations) → domain Invoice. */
export function fromSupabaseInvoice(row: JoinedInvoiceRow): Invoice {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Cliente sconosciuto",
    number: row.number,
    status: row.status as InvoiceStatus,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    subtotal: row.subtotal,
    taxRate: row.tax_rate,
    withholdingTaxRate: row.withholding_tax_rate,
    total: row.total,
    currency: (row.currency as Invoice["currency"]) ?? "EUR",
    paymentLink: row.payment_link ?? null,
    paidAt: row.paid_at ?? null,
    notes: row.notes ?? null,
    items: (row.invoice_items ?? []).map(fromSupabaseLineItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

/** Map a Supabase invoice_item row → domain LineItem. */
export function fromSupabaseLineItem(row: DbInvoiceItem): LineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    taxRate: row.tax_rate,
  };
}

/** Map a Supabase invoice_event row → domain InvoiceEvent. */
export function fromSupabaseInvoiceEvent(row: DbInvoiceEvent): InvoiceEvent {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    eventType: row.event_type as InvoiceEvent["eventType"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}

// ─── Client ───

/** Map a Supabase client row → domain Client. */
export function fromSupabaseClient(row: DbClient): Client {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    vatNumber: row.vat_number ?? null,
    address: row.address ?? null,
    city: null,
    postalCode: null,
    country: null,
    currency: (row.currency as Client["currency"]) ?? "EUR",
    phone: row.phone ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Organization ───

type DbOrg = Database["public"]["Tables"]["organizations"]["Row"];

/** Map a Supabase organization row → domain Organization. */
export function fromSupabaseOrganization(row: DbOrg): Organization {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url ?? null,
    brandColor: row.brand_color ?? null,
    stripeAccountId: row.stripe_account_id ?? null,
    plan: row.plan as Organization["plan"],
    iban: row.iban ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}
