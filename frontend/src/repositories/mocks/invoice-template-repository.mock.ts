// ─── Invoice Template Repository — Mock implementation ───

import type { InvoiceTemplateRepository, CreateTemplateInput, UpdateTemplateInput } from "@/repositories/interfaces/invoice-template-repository";
import type { InvoiceTemplate } from "@/types/models/invoice-template";

const MOCK_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "tpl-1",
    orgId: "org-1",
    name: "Classico",
    isDefault: true,
    layout: "classic",
    colorScheme: "light",
    primaryColor: "#1e293b",
    accentColor: "#3b82f6",
    showLogo: true,
    logoPosition: "header_right",
    logoMaxHeight: 20,
    fontFamily: "inter",
    fontSizeBody: 10,
    fontSizeHeading: 16,
    showSenderDetails: true,
    showClientDetails: true,
    showPaymentTerms: true,
    showNotes: true,
    showThankYou: true,
    thankYouMessage: "Grazie per la fiducia!",
    signaturePosition: "above_footer",
    customFields: [],
    footerText: "Marco Rossi Freelance — P.IVA 12345678901 — IBAN IT00X0000000000000000000000",
    createdAt: "2026-01-15T08:00:00Z",
    updatedAt: null,
  },
  {
    id: "tpl-2",
    orgId: "org-1",
    name: "Moderno",
    isDefault: false,
    layout: "modern",
    colorScheme: "brand",
    primaryColor: "#7c3aed",
    accentColor: "#a78bfa",
    showLogo: true,
    logoPosition: "header_center",
    logoMaxHeight: 25,
    fontFamily: "geist",
    fontSizeBody: 11,
    fontSizeHeading: 18,
    showSenderDetails: true,
    showClientDetails: true,
    showPaymentTerms: true,
    showNotes: false,
    showThankYou: true,
    thankYouMessage: "A presto! 🚀",
    signaturePosition: "below_items",
    customFields: [
      { id: "cf-1", label: "Codice CIG", value: "ABC123", position: "header", bold: false, italic: false },
    ],
    footerText: null,
    createdAt: "2026-05-10T12:00:00Z",
    updatedAt: "2026-05-20T09:00:00Z",
  },
];

const PREVIEW_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: Inter, sans-serif; color: #1e293b; padding: 40px; max-width: 700px; margin: auto; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 24px; font-weight: 700; }
  .title { font-size: 28px; font-weight: 300; color: #64748b; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th { text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .total { text-align: right; font-size: 20px; font-weight: 700; margin-top: 24px; }
  .footer { margin-top: 48px; color: #94a3b8; font-size: 11px; text-align: center; }
</style></head><body>
  <div class="header"><div class="logo">Marco Rossi</div><div>Freelance Designer</div></div>
  <div class="title">FATTURA</div>
  <p><strong>Cliente:</strong> Studio Legale Rossi<br><strong>Data:</strong> 01/06/2026<br><strong>Scadenza:</strong> 01/07/2026</p>
  <table><thead><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>Totale</th></tr></thead><tbody>
    <tr><td>Consulenza GDPR</td><td>1</td><td>€ 1.500,00</td><td>€ 1.500,00</td></tr>
  </tbody></table>
  <div class="total">Totale: € 1.200,00 <small>(rit. 20%)</small></div>
  <div class="footer">Marco Rossi Freelance — P.IVA 12345678901 — IBAN IT00X0000000000000000000000</div>
</body></html>`;

export function createInvoiceTemplateRepositoryMock(): InvoiceTemplateRepository {
  let templates = [...MOCK_TEMPLATES];

  return {
    async list(_orgId: string): Promise<InvoiceTemplate[]> {
      await new Promise((r) => setTimeout(r, 300));
      return templates;
    },

    async getDefault(_orgId: string): Promise<InvoiceTemplate | null> {
      await new Promise((r) => setTimeout(r, 200));
      return templates.find((t) => t.isDefault) ?? null;
    },

    async create(_orgId: string, input: CreateTemplateInput): Promise<InvoiceTemplate> {
      await new Promise((r) => setTimeout(r, 400));
      const tpl: InvoiceTemplate = {
        id: `tpl-${Date.now()}`,
        orgId: _orgId,
        name: input.name,
        isDefault: templates.length === 0,
        layout: input.layout ?? "classic",
        colorScheme: input.colorScheme ?? "light",
        primaryColor: input.primaryColor ?? "#1e293b",
        accentColor: input.accentColor ?? "#3b82f6",
        showLogo: input.showLogo ?? true,
        logoPosition: "header_right",
        logoMaxHeight: 20,
        fontFamily: input.fontFamily ?? "inter",
        fontSizeBody: 10,
        fontSizeHeading: 16,
        showSenderDetails: input.showSenderDetails ?? true,
        showClientDetails: input.showClientDetails ?? true,
        showPaymentTerms: input.showPaymentTerms ?? true,
        showNotes: input.showNotes ?? true,
        showThankYou: input.showThankYou ?? true,
        thankYouMessage: input.thankYouMessage ?? null,
        signaturePosition: input.signaturePosition ?? "above_footer",
        customFields: input.customFields ?? [],
        footerText: input.footerText ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      templates = [tpl, ...templates];
      return tpl;
    },

    async update(templateId: string, input: UpdateTemplateInput): Promise<InvoiceTemplate> {
      await new Promise((r) => setTimeout(r, 300));
      const idx = templates.findIndex((t) => t.id === templateId);
      if (idx === -1) throw new Error("Template not found");
      templates[idx] = {
        ...templates[idx]!,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      return templates[idx]!;
    },

    async setDefault(templateId: string): Promise<InvoiceTemplate> {
      await new Promise((r) => setTimeout(r, 200));
      templates = templates.map((t) => ({ ...t, isDefault: t.id === templateId }));
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) throw new Error("Template not found");
      return tpl;
    },

    async delete(templateId: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 200));
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl?.isDefault) throw new Error("Cannot delete default template");
      templates = templates.filter((t) => t.id !== templateId);
    },

    async previewHtml(_templateId: string): Promise<string> {
      await new Promise((r) => setTimeout(r, 500));
      return PREVIEW_HTML;
    },
  };
}
