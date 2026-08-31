/**
 * upload-limits.ts — Single source of truth per i limiti di upload lato mobile.
 *
 * Mirror di `frontend/src/lib/upload-limits.ts`. Stesso valore (20 MB). I due
 * mondi hanno build diversi (Next.js vs Expo), quindi non si puo' importare
 * direttamente — la coerenza e' garantita dai test su `file-import.test.ts`.
 *
 * Era 10 MB prima di Agosto 2026; alzato per allinearsi al limite web e per
 * sbloccare upload di fatture scannerizzate a colori, che sforano i 10 MB.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/** Limite del bucket `pdf-imports` (Supabase Storage) — il PDF viaggia di qui. */
export const MAX_PDF_BUCKET_BYTES = 25 * 1024 * 1024; // 25 MB
