// ─── Repository Provider — global dependency injection for repositories ───

"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { DashboardRepository } from "@/repositories/interfaces/dashboard-repository";
import type { InvoiceRepository } from "@/repositories/interfaces/invoice-repository";
import type { AnalyticsRepository } from "@/repositories/interfaces/analytics-repository";
import type { AuthRepository } from "@/repositories/interfaces/auth-repository";
import type { ScannerRepository } from "@/repositories/interfaces/scanner-repository";
import type { SettingsRepository } from "@/repositories/interfaces/settings-repository";
import type { SignatureRepository } from "@/repositories/interfaces/signature-repository";
import type { InvoiceTemplateRepository } from "@/repositories/interfaces/invoice-template-repository";

export interface Repositories {
  dashboard: DashboardRepository;
  invoice: InvoiceRepository;
  analytics: AnalyticsRepository;
  auth: AuthRepository;
  scanner: ScannerRepository;
  settings: SettingsRepository;
  signature: SignatureRepository;
  invoiceTemplate: InvoiceTemplateRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

interface RepositoryProviderProps {
  repositories: Repositories;
  children: ReactNode;
}

export function RepositoryProvider({ repositories, children }: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}

/** Access the repository container. Throws if used outside RepositoryProvider. */
export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error(
      "useRepositories() must be used inside <RepositoryProvider>. " +
      "Wrap your app or page tree with RepositoryProvider.",
    );
  }
  return ctx;
}
