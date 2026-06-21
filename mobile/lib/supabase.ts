import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// ─── Expo SecureStore adapter for Supabase ────────────────────────────────────

/**
 * SecureStore adapter — persists session tokens in encrypted device storage.
 * This is more secure than AsyncStorage for auth tokens on mobile.
 */

const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Storage may be unavailable (e.g., device lock screen not set)
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore
    }
  },
};

// ─── Lazy Supabase client ────────────────────────────────────────────────────
//
// CRITICAL: Do NOT create the client at module scope.
// Module-scope execution runs during Hermes bundle evaluation — before React mounts
// and before any error boundary exists. A crash here produces a silent white screen.
//
// Instead, we defer client creation until first access (lazy initialization).
// The supabase client will be created on first use, inside the React component tree.

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
  const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[BOOT ERROR] Supabase URL/Anon Key missing from Constants.expoConfig.extra. " +
        "Auth will not work. Check app.json > expo.extra and rebuild."
    );
  }

  supabaseClient = createClient(
    supabaseUrl || "https://missing-supabase-url.invalid",
    supabaseAnonKey || "missing-anon-key",
    {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  );

  return supabaseClient;
}

// Export a proxy that lazily creates the client on first access
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  },
});

// ─── Type helpers ─────────────────────────────────────────────────────────────

export type { Session, User, AuthError } from "@supabase/supabase-js";
