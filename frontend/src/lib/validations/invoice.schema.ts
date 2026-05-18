import { z } from "zod";

// ─── Line Item ────────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  quantity: z.number().min(1, "Quantità minima: 1"),
  unitPrice: z.number().min(0, "Il prezzo non può essere negativo"),
});

// ─── Create Invoice ───────────────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]),
  items: z.array(lineItemSchema).min(1, "Inserisci almeno una voce"),
  dueDate: z.string().refine(
    (d) => new Date(d) > new Date(),
    "La scadenza deve essere futura"
  ),
  vatRate: z.number().min(0, "IVA minima: 0%").max(100, "IVA massima: 100%"),
  withholdingTaxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ─── Update Invoice Status ────────────────────────────────────────────────────

export const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().uuid(),
  status: z.enum(["draft", "sent", "overdue", "paid"]),
});

export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;

// ─── Create Client ────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().email("Email non valida"),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
