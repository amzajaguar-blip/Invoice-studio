"use client";

import { ErrorView } from "@/components/ui-states";

export default function ClientsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView message={error.message || "Errore nel caricamento clienti"} onRetry={reset} />;
}
