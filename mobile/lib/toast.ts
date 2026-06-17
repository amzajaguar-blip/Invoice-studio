import { createContext, useContext } from "react";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToastConfig {
  message: string;
  type: "success" | "error" | "info";
  duration?: number; // default 3000ms
}

export interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useToast — accede al contesto toast globale.
 * Deve essere usato all'interno di un ToastProvider montato in app/_layout.tsx.
 *
 * @example
 * const { showToast } = useToast();
 * showToast({ message: "Cliente aggiunto ✓", type: "success" });
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
