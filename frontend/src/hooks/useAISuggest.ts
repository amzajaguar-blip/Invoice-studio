"use client";

import { useState, useCallback } from "react";

/**
 * useAISuggest — light hook for AI-powered invoice suggestions.
 * Calls POST /api/ai/suggest with type + context, returns the suggestion.
 */

interface AISuggestInput {
  type: "description" | "notes" | "client_message";
  context?: Record<string, unknown>;
  prompt?: string;
}

export function useAISuggest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(
    async (input: AISuggestInput): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Errore AI");
        return json.suggestion || null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { suggest, loading, error };
}
