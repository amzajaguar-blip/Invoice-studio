/**
 * useInvoiceFilters — Hook per la ricerca e il filtraggio in-memory delle fatture
 *
 * Espone:
 *  - `filterInvoices` — funzione pura che applica i filtri a un array di fatture
 *  - `useInvoiceFilters` — hook che combina filterInvoices, debounce (300ms) e useMemo
 *
 * @see Requisiti 4.3, 4.4, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 * @see design.md § 2.2 Modello dati filtri
 * @see design.md § 2.3 Algoritmo di filtro
 * @see design.md § 2.4 Hook useInvoiceFilters
 */

import { useState, useMemo } from 'react';
import { useDebounce } from '@/lib/useDebounce';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface DateRange {
  preset: 'month' | 'quarter' | 'year' | 'custom';
  from: Date;
  to: Date;
}

export interface InvoiceFilters {
  /** Testo di ricerca full-text su number, clients.name, total */
  query: string;
  /** Filtro per status; "all" disabilita il filtro */
  status: InvoiceStatus | 'all';
  /** Filtro per id cliente; null disabilita il filtro */
  clientId: string | null;
  /** Filtro per intervallo di date; null disabilita il filtro */
  dateRange: DateRange | null;
}

/** Sottinsieme del tipo Invoice usato da questo hook.
 *  Il tipo completo è definito in invoices.tsx; qui dichiariamo
 *  solo i campi necessari per il filtraggio per evitare dipendenze circolari. */
export interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  clients?: {
    id?: string;
    name: string;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// Filtri predefiniti
// ---------------------------------------------------------------------------

export const DEFAULT_FILTERS: InvoiceFilters = {
  query: '',
  status: 'all',
  clientId: null,
  dateRange: null,
};

// ---------------------------------------------------------------------------
// filterInvoices — funzione pura
// ---------------------------------------------------------------------------

/**
 * Applica i filtri a un array di fatture in memoria.
 *
 * Regole:
 * - Non muta l'array originale (usa `[...invoices]` come punto di partenza)
 * - I filtri sono applicati in AND: ogni fattura deve soddisfare tutti i criteri attivi
 * - Filtro status: saltato se `status === "all"`
 * - Filtro clientId: confronta `inv.clients?.id`; saltato se `clientId === null`
 * - Filtro dateRange: estremi inclusi, usa `new Date(inv.created_at)`; saltato se `dateRange === null`
 * - Filtro query: case-insensitive su `number`, `clients.name`, `String(total)`; saltato se query è vuota
 *
 * @param invoices - Array di fatture da filtrare
 * @param filters  - Criteri di filtro da applicare
 * @returns Nuovo array con le fatture che soddisfano tutti i criteri attivi
 *
 * @see Requisiti 4.3, 4.4, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function filterInvoices(invoices: Invoice[], filters: InvoiceFilters): Invoice[] {
  // Copia shallow per non mutare l'originale (Requisito 6.4)
  let result = [...invoices];

  // 1. Filtro status (Requisito 5.2)
  if (filters.status !== 'all') {
    result = result.filter((inv) => inv.status === filters.status);
  }

  // 2. Filtro clientId (Requisito 6.1)
  if (filters.clientId !== null) {
    result = result.filter((inv) => inv.clients?.id === filters.clientId);
  }

  // 3. Filtro dateRange — estremi inclusi (Requisito 6.2)
  if (filters.dateRange !== null) {
    const { from, to } = filters.dateRange;
    result = result.filter((inv) => {
      const d = new Date(inv.created_at);
      return d >= from && d <= to;
    });
  }

  // 4. Ricerca full-text — case-insensitive (Requisiti 4.3, 4.4)
  const trimmedQuery = filters.query.trim();
  if (trimmedQuery) {
    const q = trimmedQuery.toLowerCase();
    result = result.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        (inv.clients?.name ?? '').toLowerCase().includes(q) ||
        String(inv.total).includes(q)
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// useInvoiceFilters — hook
// ---------------------------------------------------------------------------

/**
 * Hook che combina `filterInvoices`, debounce (300ms) e `useMemo` per il
 * filtraggio in-memory delle fatture con reattività ottimizzata.
 *
 * @param invoices - Array di fatture da filtrare (di solito dallo stato del componente)
 * @returns Oggetto con:
 *   - `filters` — stato corrente dei filtri
 *   - `setFilters` — setter per aggiornare i filtri
 *   - `filtered` — array di fatture filtrate (memoizzato)
 *   - `hasActiveFilter` — true se almeno un filtro è attivo
 *
 * @see Requisiti 4.3, 4.4, 5.2, 6.1–6.6
 * @see design.md § 2.4 Hook useInvoiceFilters
 */
export function useInvoiceFilters(invoices: Invoice[]) {
  const [filters, setFilters] = useState<InvoiceFilters>(DEFAULT_FILTERS);

  // Debounce della query testuale — 300ms (Requisito 4.2)
  const debouncedQuery = useDebounce(filters.query, 300);

  // Filtri "attivi" con la query già debouncata
  const activeFilters: InvoiceFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery]
  );

  // Lista filtrata — ricalcolata solo quando cambiano le fatture o i filtri (Requisito 6.3)
  const filtered = useMemo(
    () => filterInvoices(invoices, activeFilters),
    [invoices, activeFilters]
  );

  // Flag utile per mostrare EmptyState contestuale
  const hasActiveFilter =
    activeFilters.status !== 'all' ||
    activeFilters.clientId !== null ||
    activeFilters.dateRange !== null ||
    activeFilters.query.trim() !== '';

  return { filters, setFilters, filtered, hasActiveFilter };
}
