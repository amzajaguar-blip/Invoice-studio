/**
 * AppProviders — Unified provider composition for InvoiceStudio
 *
 * All providers are composed here in the correct order (dependencies first).
 * Adding new providers should follow this rule: if a provider's hook uses
 * another context, that context's provider must wrap it.
 *
 * Current order (outer → inner):
 * 1. ThemeProvider      — base theme, no dependencies
 * 2. ToastProvider      — UI feedback, no dependencies
 * 3. AuthProvider       — session/auth state, no dependencies
 * 4. PlanProvider       — subscription plan, depends on Auth
 * 5. EngagementProvider — milestones/achievements, depends on Auth
 * 6. LocaleProvider     — i18n, no dependencies
 *
 * @see react-provider-context-fix skill
 */

import { ReactNode } from "react";
import { ThemeProvider } from "@/hooks/ThemeContext";
import { AuthProvider } from "@/hooks/useAuth";
import { PlanProvider } from "@/context/PlanContext";
import { EngagementProvider } from "@/context/EngagementContext";
import { ToastProvider } from "@/components/ToastProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { runI18nDevCheck } from "@/lib/i18n-dev-check";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  if (__DEV__) {
    runI18nDevCheck();
  }
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <PlanProvider>
            <EngagementProvider>
              <LocaleProvider>{children}</LocaleProvider>
            </EngagementProvider>
          </PlanProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
