-- VELA Pivot Prodotto: aggiornamento additivo tabella clients per Rubrica
-- Task 1.5 — Migrazione contacts (solo ADD COLUMN IF NOT EXISTS — nessuna modifica a colonne esistenti)
--
-- VINCOLO CRITICO:
--   - NON modifica organizations.plan né user_plan.plan
--   - NON tocca colonne esistenti della tabella clients
--   - Idempotente: ADD COLUMN IF NOT EXISTS su tutte le colonne
--
-- Contesto: la tabella clients esiste già con almeno: id, org_id, name, email,
-- address, created_at, updated_at. Il tipo Client TypeScript indica già phone e
-- taxId — ma potrebbero mancare nella tabella reale su istanze più datate.
-- ADD COLUMN IF NOT EXISTS garantisce idempotenza su qualsiasi stato iniziale.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'EUR';
