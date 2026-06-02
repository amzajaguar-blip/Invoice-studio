// ─── useDashboardState — custom hook wrapping DashboardRepository with UiState ───

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardUiState, DashboardData } from "@/types/states/dashboard";
import {
  loading,
  success,
  empty,
  error,
  offline,
} from "@/types/states/base";
import type { DashboardRepository } from "@/repositories/interfaces/dashboard-repository";

export function useDashboardState(repository: DashboardRepository, orgId: string) {
  const [state, setState] = useState<DashboardUiState>(loading());
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setState(loading());
    try {
      const data: DashboardData = await repository.getDashboardData(orgId);
      if (!mountedRef.current) return;
      setState(
        data.recentInvoices.length === 0 && data.kpis.length === 0
          ? empty("Nessun dato disponibile. Crea la tua prima fattura per iniziare.")
          : success(data),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore di connessione";
      if (message.includes("network") || message.includes("fetch")) {
        setState(offline<DashboardData>(undefined));
      } else {
        // eslint-disable-next-line react-hooks/immutability
        setState(error(message, () => fetch()));
      }
    }
  }, [repository, orgId]);

  const refresh = useCallback(async () => {
    try {
      const kpis = await repository.refreshKpis(orgId);
      if (!mountedRef.current) return;
      setState((prev) => {
        if (prev.status === "success") {
          return success({ ...prev.data, kpis });
        }
        return prev;
      });
    } catch {
      // Silent refresh failure — keep existing state
    }
  }, [repository, orgId]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { state, refresh, retry: fetch };
}
