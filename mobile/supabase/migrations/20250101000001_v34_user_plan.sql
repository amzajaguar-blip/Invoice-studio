-- ============================================================================
-- InvoiceStudio V34 — Migration 001: user_plan + atomic_apply_boost RPC
-- 
-- Covers tasks: 1.1
-- Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.8, 10.1, 10.2
--
-- Run AFTER the main migration.sql (which creates public.organizations)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Tabella `user_plan`
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_plan (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id),
  plan            TEXT        NOT NULL DEFAULT 'free'
                              CHECK (plan IN ('free', 'premium')),

  -- Limiti mensili base (non includono boost)
  invoices_limit  INT         NOT NULL DEFAULT 5,
  customers_limit INT         NOT NULL DEFAULT 3,
  quotes_limit    INT         NOT NULL DEFAULT 3,

  -- Contatori mese corrente
  invoices_used   INT         NOT NULL DEFAULT 0,
  customers_used  INT         NOT NULL DEFAULT 0,
  quotes_used     INT         NOT NULL DEFAULT 0,
  period_start    DATE        NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),

  -- Boost attivo (da rewarded ad, 24h TTL)
  boost_invoices_extra    INT         NOT NULL DEFAULT 0,
  boost_customers_extra   INT         NOT NULL DEFAULT 0,
  boost_quotes_extra      INT         NOT NULL DEFAULT 0,
  boost_expires_at        TIMESTAMPTZ,

  -- Rewarded ads giornalieri
  daily_ads_watched INT         NOT NULL DEFAULT 0,
  daily_ads_date    DATE        DEFAULT CURRENT_DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id)
);

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_plan_org ON public.user_plan(org_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

-- Reuse existing update_updated_at() if present, create if missing
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_plan_updated_at ON public.user_plan;
CREATE TRIGGER trg_user_plan_updated_at
  BEFORE UPDATE ON public.user_plan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Row Level Security
-- Requirements: 10.1
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_plan ENABLE ROW LEVEL SECURITY;

-- SELECT: org owner only (org_id must match the org owned by the current user)
DO $$ BEGIN
  CREATE POLICY "user_plan_select_owner"
    ON public.user_plan
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
  CREATE POLICY "user_plan_insert_owner"
    ON public.user_plan
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
  CREATE POLICY "user_plan_update_owner"
    ON public.user_plan
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

-- DELETE: explicitly denied for all client roles (no policy = no access)
-- (No DELETE policy is created — RLS blocks DELETE by default when enabled)

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Tabella `boost_callback_ids` — idempotency log
-- Requirements: 2.8, 10.2
--
-- Stores every AdMob callbackId that has been applied as a boost.
-- The UNIQUE constraint on callback_id prevents double-spend.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.boost_callback_ids (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  callback_id  TEXT        NOT NULL,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT boost_callback_ids_callback_id_unique UNIQUE (callback_id)
);

CREATE INDEX IF NOT EXISTS idx_boost_callbacks_org
  ON public.boost_callback_ids(org_id);

ALTER TABLE public.boost_callback_ids ENABLE ROW LEVEL SECURITY;

-- Owner can insert their own callback records
DO $$ BEGIN
  CREATE POLICY "boost_callbacks_insert_owner"
    ON public.boost_callback_ids
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

-- Owner can select their own callback records (needed by RPC to verify)
DO $$ BEGIN
  CREATE POLICY "boost_callbacks_select_owner"
    ON public.boost_callback_ids
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: RPC `atomic_apply_boost`
-- Requirements: 2.1, 2.2, 2.8, 10.2
--
-- Atomically applies a Business Boost to user_plan for the given org_id.
-- Idempotent: if callback_id is already in boost_callback_ids, returns the
-- existing user_plan row without modifying anything.
--
-- Boost effect:
--   - boost_invoices_extra  = 3
--   - boost_customers_extra = 1
--   - boost_quotes_extra    = 1
--   - boost_expires_at      = NOW() + interval '24 hours'  (TTL reset, no stacking)
--   - daily_ads_watched     incremented by 1
--   - daily_ads_date        set to CURRENT_DATE (resets counter if different day)
--
-- Returns: the current user_plan row (after update or as-is for duplicate)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atomic_apply_boost(
  p_org_id      UUID,
  p_callback_id TEXT
)
RETURNS SETOF public.user_plan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_row   public.user_plan%ROWTYPE;
  v_today      DATE := CURRENT_DATE;
BEGIN
  -- ── 1. Idempotency check: if this callback_id was already processed,
  --       return the existing user_plan row without any modification.
  IF EXISTS (
    SELECT 1
    FROM public.boost_callback_ids
    WHERE callback_id = p_callback_id
  ) THEN
    RETURN QUERY
      SELECT *
      FROM public.user_plan
      WHERE org_id = p_org_id;
    RETURN;
  END IF;

  -- ── 2. Lock the user_plan row to prevent races.
  SELECT * INTO v_plan_row
  FROM public.user_plan
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_plan row not found for org_id %', p_org_id;
  END IF;

  -- ── 3. Register the callback_id (UNIQUE constraint enforces idempotency
  --       at DB level even under concurrent requests).
  INSERT INTO public.boost_callback_ids (org_id, callback_id)
  VALUES (p_org_id, p_callback_id);

  -- ── 4. Apply the boost.
  --       - Boost credits are fixed amounts (not additive): always set to
  --         the configured values so repeated boosts only reset the TTL.
  --       - daily_ads_watched is incremented; reset to 1 if date changed.
  UPDATE public.user_plan
  SET
    boost_invoices_extra  = 3,
    boost_customers_extra = 1,
    boost_quotes_extra    = 1,
    boost_expires_at      = NOW() + INTERVAL '24 hours',
    daily_ads_watched     = CASE
                              WHEN daily_ads_date < v_today THEN 1
                              ELSE daily_ads_watched + 1
                            END,
    daily_ads_date        = v_today,
    updated_at            = NOW()
  WHERE org_id = p_org_id;

  -- ── 5. Return the updated row.
  RETURN QUERY
    SELECT *
    FROM public.user_plan
    WHERE org_id = p_org_id;
END;
$$;

-- Grant execute to authenticated users (RLS on user_plan still applies)
GRANT EXECUTE ON FUNCTION public.atomic_apply_boost(UUID, TEXT)
  TO authenticated;

-- ============================================================================
-- END OF MIGRATION 001
-- ============================================================================
