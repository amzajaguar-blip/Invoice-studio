// ─── Settings Repository — Mock implementation ───

import type { SettingsRepository } from "@/repositories/interfaces/settings-repository";
import type { OrganizationSettings } from "@/types/models";

export function createSettingsRepositoryMock(): SettingsRepository {
  const stored: OrganizationSettings = {
    orgId: "org-1",
    currency: "EUR",
    defaultTaxRate: 0,
    withholdingTaxRate: 20,
    invoicePrefix: "FATT-",
    nextInvoiceNumber: 5,
    defaultPaymentTerms: 30,
  };

  return {
    async getSettings(_orgId: string) {
      await new Promise((r) => setTimeout(r, 300));
      return {
        organization: {
          id: "org-1",
          name: "Marco Rossi Freelance",
          logoUrl: null,
          brandColor: null,
          stripeAccountId: null,
          plan: "free",
          iban: null,
          createdAt: "2026-01-15T08:00:00Z",
          updatedAt: null,
        },
        settings: { ...stored },
      };
    },
    async updateSettings(_orgId: string, update: Partial<OrganizationSettings>) {
      await new Promise((r) => setTimeout(r, 400));
      Object.assign(stored, update);
      return { ...stored };
    },
  };
}
