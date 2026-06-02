// ─── Base UiState discriminated unions ───
// Every screen state is one of these five variants.

/** Generic loading state. */
export interface LoadingState {
  status: "loading";
}

/** Success state carrying typed data. */
export interface SuccessState<T> {
  status: "success";
  data: T;
}

/** Empty state — no data exists yet (e.g. first invoice). */
export interface EmptyState {
  status: "empty";
  message?: string;
}

/** Error state with recoverable action. */
export interface ErrorState {
  status: "error";
  message: string;
  retry?: () => void;
}

/** Offline state — network unavailable, cached data may be shown. */
export interface OfflineState<T = unknown> {
  status: "offline";
  cachedData?: T;
  lastSyncedAt?: string;
}

/** Composite: all possible states for a screen. */
export type UiState<T> =
  | LoadingState
  | SuccessState<T>
  | EmptyState
  | ErrorState
  | OfflineState<T>;

// ─── Helpers ───

export function loading(): LoadingState {
  return { status: "loading" };
}

export function success<T>(data: T): SuccessState<T> {
  return { status: "success", data };
}

export function empty(message?: string): EmptyState {
  return { status: "empty", message };
}

export function error(message: string, retry?: () => void): ErrorState {
  return { status: "error", message, retry };
}

export function offline<T>(cachedData?: T, lastSyncedAt?: string): OfflineState<T> {
  return { status: "offline", cachedData, lastSyncedAt };
}

// ─── Type guards ───

export function isLoading<T>(state: UiState<T>): state is LoadingState {
  return state.status === "loading";
}

export function isSuccess<T>(state: UiState<T>): state is SuccessState<T> {
  return state.status === "success";
}

export function isEmpty<T>(state: UiState<T>): state is EmptyState {
  return state.status === "empty";
}

export function isError<T>(state: UiState<T>): state is ErrorState {
  return state.status === "error";
}

export function isOffline<T>(state: UiState<T>): state is OfflineState<T> {
  return state.status === "offline";
}
