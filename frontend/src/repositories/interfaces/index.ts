// ─── Repository interfaces barrel ───

export type { DashboardRepository } from "./dashboard-repository";
export type {
  InvoiceRepository,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from "./invoice-repository";
export type { AnalyticsRepository } from "./analytics-repository";
export type { AuthRepository, AuthResult } from "./auth-repository";
export type { ScannerRepository } from "./scanner-repository";
export type { SettingsRepository } from "./settings-repository";
export type { SignatureRepository, CreateSignatureInput } from "./signature-repository";
export type { InvoiceTemplateRepository, CreateTemplateInput, UpdateTemplateInput } from "./invoice-template-repository";
export type { ClientRepository, CreateClientInput, UpdateClientInput } from "./client-repository";
