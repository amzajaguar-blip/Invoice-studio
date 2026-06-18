-- ============================================================================
-- InvoiceStudio V34 — Migration 003: user_engagement
--
-- Covers tasks: 8.1
-- Requirements: 7.5, 7.6, 7.7, 7.8, 10.1, 13.1, 13.8
--
-- Run AFTER migration 001 (user_plan) and 002 (analytics_events / notification_log)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Tabella `user_engagement`
--
-- Traccia milestone, streak e attività lifetime per l'Engagement Engine.
--
-- Milestone invoice levels (Requirement 13.1, 13.8):
--   1 (First Invoice), 10, 25, 50, 100, 500, 1000
--
-- Additional milestones:
--   milestone_100_clients    — 100 clienti (Requirement 7.8)
--   milestone_review_asked   — richiesta recensione già effettuata (Requirement 13.1)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_engagement (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id),

  -- ── Contatori lifetime ────────────────────────────────────────────────────
  total_invoices   INT         NOT NULL DEFAULT 0,
  total_customers  INT         NOT NULL DEFAULT 0,
  total_quotes     INT         NOT NULL DEFAULT 0,
  total_revenue    NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- ── Streak (giorni consecutivi con almeno un'attività fatturabile) ─────────
  current_streak   INT         NOT NULL DEFAULT 0,
  longest_streak   INT         NOT NULL DEFAULT 0,
  last_active_date DATE,

  -- ── Milestone flags — invoice count levels (Requirements 13.1, 13.8) ──────
  -- true = milestone già celebrata; una volta impostata a true non si resetta mai
  milestone_1_invoice      BOOLEAN     NOT NULL DEFAULT false,  -- 1ª fattura
  milestone_10_invoices    BOOLEAN     NOT NULL DEFAULT false,  -- 10 fatture
  milestone_25_invoices    BOOLEAN     NOT NULL DEFAULT false,  -- 25 fatture
  milestone_50_invoices    BOOLEAN     NOT NULL DEFAULT false,  -- 50 fatture
  milestone_100_invoices   BOOLEAN     NOT NULL DEFAULT false,  -- 100 fatture
  milestone_500_invoices   BOOLEAN     NOT NULL DEFAULT false,  -- 500 fatture
  milestone_1000_invoices  BOOLEAN     NOT NULL DEFAULT false,  -- 1000 fatture

  -- ── Milestone flags — altri traguardi (Requirements 7.8, 13.1) ───────────
  milestone_100_clients    BOOLEAN     NOT NULL DEFAULT false,  -- 100 clienti
  milestone_review_asked   BOOLEAN     NOT NULL DEFAULT false,  -- recensione richiesta

  -- ── Ads & premium ─────────────────────────────────────────────────────────
  total_ads_watched  INT         NOT NULL DEFAULT 0,
  is_premium         BOOLEAN     NOT NULL DEFAULT false,
  premium_since      TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Constraints ────────────────────────────────────────────────────────────
  -- Una riga per organizzazione (Requirement 10.1)
  CONSTRAINT user_engagement_org_id_unique UNIQUE (org_id)
);

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_engagement_org
  ON public.user_engagement(org_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

-- Riutilizza update_updated_at() creata nella migration 001 (user_plan).
-- La funzione è già definita come CREATE OR REPLACE, quindi è idempotente.

DROP TRIGGER IF EXISTS trg_user_engagement_updated_at ON public.user_engagement;
CREATE TRIGGER trg_user_engagement_updated_at
  BEFORE UPDATE ON public.user_engagement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Row Level Security
-- Requirements: 10.1
--
-- Stessa strategia di user_plan:
--   SELECT / INSERT / UPDATE solo per l'owner dell'organizzazione.
--   DELETE non è consentito da nessun ruolo client (nessuna policy DELETE = denied).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

-- SELECT: org owner only
DO $$ BEGIN
  CREATE POLICY "user_engagement_select_owner"
    ON public.user_engagement
    FOR SELECT
    USING (
      org_id = (
        SELECT om.org_id
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.role = 'owner'
        LIMIT 1
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: org owner only
DO $$ BEGIN
  CREATE POLICY "user_engagement_insert_owner"
    ON public.user_engagement
    FOR INSERT
    WITH CHECK (
      org_id = (
        SELECT om.org_id
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.role = 'owner'
        LIMIT 1
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: org owner only
DO $$ BEGIN
  CREATE POLICY "user_engagement_update_owner"
    ON public.user_engagement
    FOR UPDATE
    USING (
      org_id = (
        SELECT om.org_id
        FROM public.org_members om
        WHERE om.user_id = auth.uid()
          AND om.role = 'owner'
        LIMIT 1
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: esplicitamente vietato per tutti i ruoli client.
-- Nessuna policy DELETE viene creata → RLS nega DELETE per default quando abilitato.

-- ============================================================================
-- END OF MIGRATION 003
-- ============================================================================
