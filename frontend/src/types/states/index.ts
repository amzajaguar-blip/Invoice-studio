// ─── UiState barrel ───

export {
  type UiState,
  type LoadingState,
  type SuccessState,
  type EmptyState,
  type ErrorState,
  type OfflineState,
  loading,
  success,
  empty,
  error,
  offline,
  isLoading,
  isSuccess,
  isEmpty,
  isError,
  isOffline,
} from "./base";

export type { DashboardData, DashboardKpi, DashboardUiState } from "./dashboard";
export type {
  InvoiceListData,
  InvoiceListFilter,
  InvoiceListUiState,
  InvoiceDetailData,
  InvoiceDetailUiState,
} from "./invoice";
export type {
  AnalyticsData,
  ClientRevenue,
  RecoveryStats,
  AnalyticsUiState,
} from "./analytics";
export type {
  SettingsData,
  SettingsSection,
  SettingsUiState,
} from "./settings";
export type {
  ScannerData,
  ScannerStep,
  ScannerExtractedData,
  ScannerLineItem,
  ScannerUiState,
} from "./scanner";
export type { ClientsData, ClientsUiState } from "./clients";
