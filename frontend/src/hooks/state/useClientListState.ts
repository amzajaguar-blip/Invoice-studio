// ─── useClientListState — custom hook for client listing ───

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientsUiState } from "@/types/states/clients";
import { loading, success, empty, error, offline } from "@/types/states/base";
import type { ClientRepository } from "@/repositories/interfaces/client-repository";

export function useClientListState(repository: ClientRepository, orgId: string) {
  const [state, setState] = useState<ClientsUiState>(loading());
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setState(loading());
    try {
      const clients = await repository.list(orgId);
      if (!mountedRef.current) return;
      setState(
        clients.length === 0
          ? empty("Nessun cliente. Aggiungi il tuo primo cliente!")
          : success({ clients, total: clients.length }),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore nel caricamento clienti";
      if (message.includes("network") || message.includes("fetch")) {
        setState(offline());
      } else {
        // eslint-disable-next-line react-hooks/immutability
        setState(error(message, () => fetch()));
      }
    }
  }, [repository, orgId]);

  const deleteClient = useCallback(async (clientId: string) => {
    try {
      await repository.delete(clientId);
      await fetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      setState(error(message, () => fetch()));
    }
  }, [repository, fetch]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { state, refresh: fetch, deleteClient };
}
