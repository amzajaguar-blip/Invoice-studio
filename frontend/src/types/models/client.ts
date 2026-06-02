// ─── Client domain model ───

export interface Client {
  id: string;
  orgId: string;
  name: string;
  email: string;
  vatNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  currency: "EUR" | "USD" | "GBP" | "CHF";
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}
