// ─── useInvoiceListState — custom hook for invoice listing with filter/pagination ───

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InvoiceListUiState, InvoiceListFilter } from "@/types/states/invoice";
import { loading, success, empty, error, offline } from "@/types/states/base";
import type { Invoice } from "@/types/models";
import type { InvoiceRepository } from "@/repositories/interfaces/invoice-repository";

export function useInvoiceListState(repository: InvoiceRepository, orgId: string) {
  const [state, setState] = useState<InvoiceListUiState>(loading());
  const [filter, setFilter] = useState<InvoiceListFilter>("all");
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setState(loading());
    try {
      const result = await repository.list(orgId, filter);
      if (!mountedRef.current) return;
      setState(
        result.invoices.length === 0
          ? empty("Nessuna fattura trovata. Crea la tua prima fattura!")
          : success({ invoices: result.invoices, total: result.total, filter, page: 1, hasMore: result.hasMore }),
      );
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Errore nel caricamento fatture";
      if (message.includes("network") || message.includes("fetch")) {
        setState(offline());
      } else {
        // eslint-disable-next-line react-hooks/immutability
        setState(error(message, () => fetch()));
      }
    }
  }, [repository, orgId, filter]);

  const applyFilter = useCallback((f: InvoiceListFilter) => {
    setFilter(f);
  }, []);

  const deleteInvoice = useCallback(async (invoiceId: string) => {
    setState((prev) => (prev.status === "success" ? loading() : prev));
    try {
      await repository.delete(invoiceId);
      await fetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      setState(error(message, () => fetch()));
    }
  }, [repository, fetch]);

  const sendInvoice = useCallback(async (invoiceId: string) => {
    try {
      const updated = await repository.send(invoiceId);
      setState((prev) => {
        if (prev.status !== "success") return loading();
        const invoices = prev.data.invoices.map((i) => (i.id === invoiceId ? updated : i));
        return success({ ...prev.data, invoices });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'invio";
      setState(error(message, () => fetch()));
    }
  }, [repository, fetch]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { state, filter, applyFilter, deleteInvoice, sendInvoice, retry: fetch };
}
