-- =============================================================================
-- Migration: bucket `pdf-imports` per upload temporanei di PDF
-- Data: 2026-08-31
-- Autore: rilancio del limite upload (10 MB -> 20 MB) con migrazione PDF
--         da body-JSON a Supabase Storage signed URL.
--
-- Scopo
-- -----
-- Il flusso /api/convert/pdf-extract prima riceveva il PDF come base64 nel body
-- di una funzione serverless Vercel. Il body Vercel si ferma a 4,5 MB: questo
-- cappava i PDF a circa 3,4 MB, sotto il tetto utente di 10 MB e ancor piu'
-- sotto il nuovo 20 MB. Per sbloccare il vincolo, il client ora carica il PDF
-- DIRETTAMENTE su Supabase Storage (signed URL), e la funzione pdf-extract lo
-- scarica dal bucket, lo legge, e lo cancella subito dopo.
--
-- Caratteristiche del bucket
-- --------------------------
-- - Privato (public = false): nessun URL pubblico, accesso solo via signed URL.
-- - file_size_limit = 25 MB: un po' oltre il tetto utente (20 MB) per dare
--   margine. Non di piu': oltre i 25 MB pdfjs si appesantisce in memoria.
-- - allowed_mime_types = application/pdf: blocca a monte file non-PDF che
--   intaserebbero la rotta solo per essere rifiutati.
--
-- Policy RLS
-- ----------
-- La rotta /api/convert/pdf-extract/upload-url genera i signed URL con
-- service_role, quindi bypassa la RLS (legittimo: la funzione ha gia'
-- autenticato l'utente). La policy qui sotto e' la RETE DI SICUREZZA per gli
-- accessi DIRETTI via anon/authenticated, che non devono poter leggere o
-- scrivere file di un altro utente.
--
-- Convenzione di path
-- -------------------
-- I file sono organizzati come `<user_id>/<random-uuid>.pdf`. La policy
-- sfrutta (storage.foldername(name))[1] = auth.uid()::text per impedire a un
-- utente di scrivere/leggere nella cartella di un altro.
-- =============================================================================

-- 1. Crea o aggiorna il bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-imports',
  'pdf-imports',
  false,                                  -- privato
  26214400,                               -- 25 MB (25 * 1024 * 1024)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policy: ogni authenticated user puo' fare CRUD solo sulla propria cartella
--    (primo segmento del path = auth.uid()).
DROP POLICY IF EXISTS "pdf_imports_user_folder" ON storage.objects;
CREATE POLICY "pdf_imports_user_folder" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'pdf-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'pdf-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Nota cleanup: il server cancella i file subito dopo l'estrazione OK.
--    Un cron giornaliero per ripulire eventuali orfani (creato per errore
--    umano o crash a meta' upload) e' FUtURO SCOPE: vedi ARCHITECTURE_MAP.md
--    sezione "Storage Buckets" per il backlog.
