/**
 * lastUsed — AsyncStorage-backed "recently used clients" store.
 *
 * Keeps an append-most-recent history of the clientIds the user has invoiced,
 * with an ISO timestamp for each usage. Used by Smart Pre-fill (chips + sort).
 *
 * Shape on disk (JSON):
 *   { "<clientId>": "2026-07-29T12:34:56.000Z", ... }
 *
 * Entries never expire automatically — we cap the in-memory list to the
 * last MAX_TRACKED ids (default 50) to keep AsyncStorage small. Older entries
 * are evicted when a new id pushes the total over the cap.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "invoice_last_used_clients_v1";
const MAX_TRACKED = 50;

/**
 * Persisted shape: id → last-used ISO timestamp.
 * We keep it as a Record (not array) so updates are O(1) and lookups are fast.
 */
export type LastUsedStore = Record<string, string>;

/**
 * Normalised, in-memory representation after we sort by recency.
 * Returned to UI layers (chips, autocomplete).
 */
export interface LastUsedEntry {
  clientId: string;
  lastUsedAt: string;
}

/**
 * Read the raw store from AsyncStorage. Returns `{}` on any error so the
 * Smart Pre-fill UI degrades gracefully (chips simply won't render).
 */
export async function readLastUsed(): Promise<LastUsedStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as LastUsedStore;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist the full store. Failures are swallowed: pre-fill is best-effort.
 */
async function writeLastUsed(store: LastUsedStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort: never block the invoice save flow on storage errors.
  }
}

/**
 * Record that the given clientId was just used. Idempotent on the same id —
 * a second call within the same tick updates the timestamp rather than
 * duplicating the entry.
 */
export async function recordUsage(clientId: string): Promise<void> {
  if (!clientId || typeof clientId !== "string") return;
  const store = await readLastUsed();
  store[clientId] = new Date().toISOString();

  // Evict oldest entries if we exceed the cap. Convert to entries, sort by
  // timestamp desc, keep top MAX_TRACKED.
  const entries = Object.entries(store);
  if (entries.length > MAX_TRACKED) {
    const sorted = entries.sort(
      ([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime(),
    );
    const trimmed = sorted.slice(0, MAX_TRACKED);
    const next: LastUsedStore = {};
    for (const [id, ts] of trimmed) next[id] = ts;
    await writeLastUsed(next);
    return;
  }

  await writeLastUsed(store);
}

/**
 * Return the N most-recently-used clientIds, sorted by `lastUsedAt` descending.
 *
 * - `limit` defaults to 3 (chip strip).
 * - `excludeIds` lets the caller drop already-currently-selected ids (e.g.
 *   the active client shouldn't appear as a chip next to itself).
 */
export async function getRecentClients(
  limit: number = 3,
  excludeIds: readonly string[] = [],
): Promise<LastUsedEntry[]> {
  const store = await readLastUsed();
  const exclude = new Set(excludeIds);
  const entries: LastUsedEntry[] = Object.entries(store)
    .filter(([id]) => !exclude.has(id))
    .map(([clientId, lastUsedAt]) => ({ clientId, lastUsedAt }))
    .sort(
      (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
    );
  return entries.slice(0, Math.max(0, limit));
}

/**
 * Clear the store. Exposed for Settings → "Reset" flows / debug.
 */
export async function clearLastUsed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
