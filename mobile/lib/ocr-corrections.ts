/**
 * ocr-corrections.ts — OCR Field Correction Persistence & Learning
 * ==================================================================
 * Stores the user-corrected value of an OCR field so that future OCR
 * extractions for the same vendor can pre-fill with the last-known-good value.
 *
 * Storage shape:
 *  - Single AsyncStorage key: "@vela/ocr/corrections"
 *  - Value: JSON array of OcrCorrection (capped at MAX_RECORDS to keep payload small)
 *
 * Storage is a flat array (not a per-vendor map) so we can:
 *  - LRU-trim by `at` timestamp
 *  - Dedupe on (vendorNormalized, field) — newest wins
 *
 * Failure modes are non-fatal: errors are logged via console.warn and the
 * caller receives a sensible fallback ([] / null). Never throws.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@vela/ocr/corrections";

/** Hard cap on stored records. Older entries are trimmed by `at`. */
const MAX_RECORDS = 200;

export type OcrCorrection = {
  field: string;
  originalValue: string;
  correctedValue: string;
  vendorNormalized: string;
  at: string; // ISO 8601 timestamp
};

// ── Internal helpers ───────────────────────────────────────────────────────

async function readAll(): Promise<OcrCorrection[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: filter to entries that look like OcrCorrection.
    return parsed.filter(
      (r): r is OcrCorrection =>
        r &&
        typeof r === "object" &&
        typeof r.field === "string" &&
        typeof r.originalValue === "string" &&
        typeof r.correctedValue === "string" &&
        typeof r.vendorNormalized === "string" &&
        typeof r.at === "string"
    );
  } catch (err) {
    console.warn("[ocr-corrections] readAll failed:", err);
    return [];
  }
}

async function writeAll(records: OcrCorrection[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn("[ocr-corrections] writeAll failed:", err);
  }
}

/** Dedupe: keep newest entry per (vendorNormalized, field) pair. */
function dedupe(records: OcrCorrection[]): OcrCorrection[] {
  const map = new Map<string, OcrCorrection>();
  for (const r of records) {
    const key = `${r.vendorNormalized}::${r.field}`;
    const existing = map.get(key);
    if (!existing || existing.at < r.at) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Persist a single correction. Replaces any previous correction for the same
 * (vendorNormalized, field) pair. Storage is capped at MAX_RECORDS.
 *
 * Never throws — errors are logged.
 */
export async function recordCorrection(c: OcrCorrection): Promise<void> {
  if (!c || typeof c !== "object") return;
  // Normalize a few fields defensively.
  const sanitized: OcrCorrection = {
    field: String(c.field ?? ""),
    originalValue: String(c.originalValue ?? ""),
    correctedValue: String(c.correctedValue ?? ""),
    vendorNormalized: String(c.vendorNormalized ?? ""),
    at: c.at || new Date().toISOString(),
  };

  const all = await readAll();
  all.push(sanitized);
  let deduped = dedupe(all);

  // LRU trim by `at` desc.
  if (deduped.length > MAX_RECORDS) {
    deduped = deduped
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, MAX_RECORDS);
  }
  await writeAll(deduped);
}

/**
 * Look up the last-corrected value for a given vendor + field.
 * Returns null when no record exists or storage fails.
 */
export async function getSuggestion(
  vendorNormalized: string,
  field: string
): Promise<string | null> {
  const all = await readAll();
  const target = `${vendorNormalized}::${field}`;
  let best: OcrCorrection | null = null;
  for (const r of all) {
    if (`${r.vendorNormalized}::${r.field}` === target) {
      if (!best || best.at < r.at) best = r;
    }
  }
  return best ? best.correctedValue : null;
}

/**
 * Read all stored corrections. Used by debug / future UI; not required for
 * the main flow.
 */
export async function listAllCorrections(): Promise<OcrCorrection[]> {
  return readAll();
}

/**
 * Clear all stored corrections. Used by debug or "reset learning" UI.
 */
export async function clearAllCorrections(): Promise<void> {
  await writeAll([]);
}
