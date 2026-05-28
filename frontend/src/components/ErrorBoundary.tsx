"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors in child components.
 * Use to wrap routes/pages that might fail at render time.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-[#0a0b0f]">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <div className="text-5xl mb-6">⚠️</div>
            <h2 className="text-xl text-[#f0f0f2] mb-4 font-[Georgia,serif]">
              Si è verificato un errore imprevisto
            </h2>

            <div className="p-4 w-full rounded-xl bg-[#111318] border border-[#1e2029] overflow-auto mb-6">
              <pre className="text-xs text-[#9ca3af] whitespace-pre-wrap break-words">
                {this.state.error?.message ?? "Errore sconosciuto"}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e0] text-white font-medium text-sm cursor-pointer border-none transition-colors"
            >
              ↻ Ricarica pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
