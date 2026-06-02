// ─── UI State components — Loading, Empty, Error, Offline ───

import React from "react";
import { AlertTriangle, RefreshCw, WifiOff, FileX, Inbox } from "lucide-react";
import { DashboardSkeleton, TableSkeleton, SkeletonCard } from "./skeleton-loaders";

// ─── Loading ───

interface LoadingViewProps {
  /** Pre-built variant or custom children. */
  variant?: "dashboard" | "table" | "cards" | "inline";
  /** Custom loading message. */
  message?: string;
  /** Number of skeleton rows (table variant). */
  rows?: number;
}

export function LoadingView({ variant = "inline", message, rows = 5 }: LoadingViewProps) {
  if (variant === "dashboard") return <DashboardSkeleton />;
  if (variant === "table") return <TableSkeleton rows={rows} />;
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">{message ?? "Caricamento..."}</span>
      </div>
    </div>
  );
}

// ─── Empty ───

interface EmptyViewProps {
  message: string;
  icon?: "invoice" | "client" | "analytics" | "generic";
  action?: { label: string; onPress: () => void };
}

const emptyIcons = {
  invoice: FileX,
  client: Inbox,
  analytics: Inbox,
  generic: Inbox,
};

export function EmptyView({ message, icon = "generic", action }: EmptyViewProps) {
  const Icon = emptyIcons[icon];
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {action && (
        <button
          onClick={action.onPress}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Error ───

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" role="alert">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <p className="text-sm font-medium text-destructive mb-1">Si è verificato un errore</p>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Riprova
        </button>
      )}
    </div>
  );
}

// ─── Offline ───

interface OfflineViewProps {
  lastSyncedAt?: string;
  onRetry?: () => void;
}

export function OfflineView({ lastSyncedAt, onRetry }: OfflineViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium mb-1">Nessuna connessione</p>
      <p className="text-sm text-muted-foreground max-w-xs mb-1">
        Non sei connesso a Internet. I dati verranno sincronizzati quando tornerai online.
      </p>
      {lastSyncedAt && (
        <p className="text-xs text-muted-foreground mb-4">
          Ultima sincronizzazione: {new Date(lastSyncedAt).toLocaleString("it-IT")}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Riprova
        </button>
      )}
    </div>
  );
}

// ─── Smart container: renders the right view based on UiState ───

import type { UiState } from "@/types/states/base";
import { isLoading, isSuccess, isEmpty, isError, isOffline } from "@/types/states/base";

interface UiStateRendererProps<T> {
  state: UiState<T>;
  /** Render function for the success state. */
  children: (data: T) => React.ReactNode;
  /** Optional loading variant override. */
  loadingVariant?: "dashboard" | "table" | "cards" | "inline";
  /** Optional custom loading component (overrides variant). */
  loadingComponent?: React.ReactNode;
  /** Empty view icon. */
  emptyIcon?: "invoice" | "client" | "analytics" | "generic";
  /** Empty view action. */
  emptyAction?: { label: string; onPress: () => void };
}

export function UiStateRenderer<T>({
  state,
  children,
  loadingVariant,
  loadingComponent,
  emptyIcon,
  emptyAction,
}: UiStateRendererProps<T>) {
  if (isLoading(state)) {
    return loadingComponent ? <>{loadingComponent}</> : <LoadingView variant={loadingVariant} />;
  }

  if (isError(state)) {
    return <ErrorView message={state.message} onRetry={state.retry} />;
  }

  if (isOffline(state)) {
    return <OfflineView lastSyncedAt={state.lastSyncedAt} />;
  }

  if (isEmpty(state)) {
    return <EmptyView message={state.message ?? "Nessun dato disponibile"} icon={emptyIcon} action={emptyAction} />;
  }

  if (isSuccess(state)) {
    return <>{children(state.data)}</>;
  }

  return null;
}
