// ─── useAnalyticsState — custom hook for analytics/charts page ───

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyticsUiState } from "@/types/states/analytics";
import { loading, success, empty, error, offline } from "@/types/states/base";
import type { AnalyticsRepository } from "@/repositories/interfaces/analytics-repository";

export function useAnalyticsState(repository: AnalyticsRepository, orgId: string) {
  const [state, setState] = useState<AnalyticsUiState>(loading());
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setState(loading());
    try {
      const [revenueTrend, cashflowForecast, topClients, recoveryStats] = await Promise.all([
        repository.getRevenueTrend(orgId, 12),
        repository.getCashflowForecast(orgId, 3),
        repository.getTopClients(orgId, 10),
        repository.getRecoveryStats(orgId),
      ]);
      if (!mountedRef.current) return;

      const hasData = revenueTrend.months.length > 0 || topClients.length > 0;
      setState(
        hasData
          ? success({ revenueTrend, cashflowForecast, topClients, recoveryStats })
          : empty("Non ci sono ancora dati sufficienti per le analisi."),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore nel caricamento analisi";
      if (message.includes("network") || message.includes("fetch")) {
        setState(offline());
      } else {
        setState(error(message, () => fetch()));
      }
    }
  }, [repository, orgId]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { state, retry: fetch };
}
