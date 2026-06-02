// ─── Invoice UiState ───

import type { UiState } from "./base";
import type { Invoice } from "../models";

export type InvoiceListFilter = "all" | "draft" | "sent" | "overdue" | "paid";

export interface InvoiceListData {
  invoices: Invoice[];
  total: number;
  filter: InvoiceListFilter;
  page: number;
  hasMore: boolean;
}

export type InvoiceListUiState = UiState<InvoiceListData>;

// ─── Single invoice detail ───

export interface InvoiceDetailData {
  invoice: Invoice;
  /** Whether the invoice is currently being modified. */
  isEditing: boolean;
  /** Whether an action (send, delete) is in progress. */
  isBusy: boolean;
}

export type InvoiceDetailUiState = UiState<InvoiceDetailData>;
