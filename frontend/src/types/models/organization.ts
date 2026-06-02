// ─── Organization domain model ───

export type PlanTier = "free" | "pro" | "agency" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  stripeAccountId: string | null;
  plan: PlanTier;
  iban: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrganizationSettings {
  orgId: string;
  currency: "EUR" | "USD" | "GBP" | "CHF";
  defaultTaxRate: number;
  withholdingTaxRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultPaymentTerms: number; // days
}
