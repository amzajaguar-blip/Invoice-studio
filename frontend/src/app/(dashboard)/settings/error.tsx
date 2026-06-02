"use client";

import { ErrorView } from "@/components/ui-states";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView message={error.message || "Errore nel caricamento impostazioni"} onRetry={reset} />;
}
