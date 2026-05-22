import { supabase } from "@/lib/supabase";
import Constants from "expo-constants";

/**
 * AI suggest for mobile — calls the Next.js API endpoint.
 * Authenticates via Bearer token from the current session.
 */

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  "https://invoicestudio.app";

interface AISuggestInput {
  type: "description" | "notes" | "client_message";
  context?: Record<string, unknown>;
  prompt?: string;
}

export async function aiSuggest(
  input: AISuggestInput
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch(`${API_BASE_URL}/api/ai/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.suggestion || null;
  } catch {
    return null;
  }
}

/**
 * Generic authenticated fetch helper for mobile API calls.
 * Automatically injects Bearer token from the current session.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: "Non autenticato", status: 401 };
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        data: null,
        error: json.error || `Errore ${res.status}`,
        status: res.status,
      };
    }

    return { data: json.data ?? json, error: null, status: res.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Errore di rete",
      status: 0,
    };
  }
}
