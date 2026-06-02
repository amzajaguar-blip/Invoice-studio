"use client";

import { ErrorView } from "@/components/ui-states";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      message={error.message || "Errore nel caricamento della dashboard"}
      onRetry={reset}
    />
  );
}
