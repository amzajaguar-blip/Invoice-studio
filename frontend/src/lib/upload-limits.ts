/**
 * upload-limits.ts — Single source of truth per i limiti di upload lato web.
 *
 * Esiste in mirror in `mobile/lib/upload-limits.ts` con lo stesso valore. I due
 * mondi hanno build diversi (Next.js vs Expo), quindi non si puo' importare
 * direttamente — la coerenza e' garantita da questo commento e dai test.
 *
 * Valore: 20 MB. Era 10 MB prima di Agosto 2026; alzato per sbloccare upload
 * di fatture e scontrini piu' pesanti della media (PDF scannerizzati a colori).
 *
 * NON confondere con il limite del body Vercel (~4.5 MB), che e' un hard cap
 * infrastrutturale: per i file grandi il flusso va via Supabase Storage con
 * signed URL, NON dentro il body di una funzione serverless.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/** Limite del bucket `pdf-imports` (Supabase Storage) — il PDF viaggia di qui. */
export const MAX_PDF_BUCKET_BYTES = 25 * 1024 * 1024; // 25 MB
