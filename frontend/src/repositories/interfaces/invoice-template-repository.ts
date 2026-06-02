// ─── Invoice Template Repository interface ───
// NO API implementation. Mock only.

import type { InvoiceTemplate, TemplateLayout, TemplateColorScheme } from "@/types/models/invoice-template";
import type { InvoiceCustomField } from "@/types/models/invoice-template";

export interface InvoiceTemplateRepository {
  /** List all templates for an organization. */
  list(orgId: string): Promise<InvoiceTemplate[]>;

  /** Get the active/default template. */
  getDefault(orgId: string): Promise<InvoiceTemplate | null>;

  /** Create a new template. */
  create(
    orgId: string,
    input: CreateTemplateInput,
  ): Promise<InvoiceTemplate>;

  /** Update an existing template. */
  update(
    templateId: string,
    input: UpdateTemplateInput,
  ): Promise<InvoiceTemplate>;

  /** Set a template as the default. */
  setDefault(templateId: string): Promise<InvoiceTemplate>;

  /** Delete a template (cannot delete default). */
  delete(templateId: string): Promise<void>;

  /** Preview a template with sample data. */
  previewHtml(templateId: string): Promise<string>;
}

export interface CreateTemplateInput {
  name: string;
  layout?: TemplateLayout;
  colorScheme?: TemplateColorScheme;
  primaryColor?: string;
  accentColor?: string;
  showLogo?: boolean;
  fontFamily?: InvoiceTemplate["fontFamily"];
  showSenderDetails?: boolean;
  showClientDetails?: boolean;
  showPaymentTerms?: boolean;
  showNotes?: boolean;
  showThankYou?: boolean;
  thankYouMessage?: string;
  signaturePosition?: InvoiceTemplate["signaturePosition"];
  footerText?: string;
  customFields?: InvoiceCustomField[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  // All fields optional for update
}
