-- ============================================================================
-- InvoiceStudio — Rewarded Ads Migration (MINIMAL — no indexes)
-- Run AFTER the main migration.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 0: Helpers (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Rewarded credits & claims
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rewarded_credits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credits     integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  max_credits integer NOT NULL DEFAULT 3,
  month_key   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, month_key)
);

ALTER TABLE public.rewarded_credits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_provider       text NOT NULL DEFAULT 'admob',
  ad_provider_id    text,
  verification_hash text NOT NULL,
  reward_amount     integer NOT NULL DEFAULT 1,
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(verification_hash)
);

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

-- ─── Trigger ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_rewarded_credits_updated_at ON public.rewarded_credits;
CREATE TRIGGER trg_rewarded_credits_updated_at
  BEFORE UPDATE ON public.rewarded_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Utility functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_monthly_invoice_count(
  p_org_id uuid, p_month_key text
) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COUNT(*)::integer FROM public.invoices
  WHERE org_id = p_org_id AND deleted_at IS NULL
    AND to_char(created_at, 'YYYY-MM') = p_month_key;
$$;

CREATE OR REPLACE FUNCTION public.get_org_plan(p_org_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT plan FROM public.organizations WHERE id = p_org_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Unified revenue + abuse prevention (ADR-003)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admob_callback_id     text UNIQUE NOT NULL,
  ad_unit_id            text NOT NULL,
  reward_type           text NOT NULL DEFAULT 'invoice_credit',
  reward_amount         integer NOT NULL DEFAULT 1 CHECK (reward_amount > 0),
  verification_status   text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected','duplicate')),
  verified_at           timestamptz,
  estimated_earnings_usd_micros bigint,
  ip_address            text,
  user_agent_hash       text,
  device_fingerprint    text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.revenue_events (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  revenue_source            text NOT NULL CHECK (revenue_source IN ('subscription','commission','ad_reward')),
  amount_cents              integer NOT NULL,
  currency                  text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR','USD')),
  exchange_rate             numeric(10,6),
  subscription_id           text,
  stripe_charge_id          text,
  ad_impression_id          uuid REFERENCES public.ad_impressions(id),
  recognition_period_start  date,
  recognition_period_end    date,
  recognized_amount_cents   integer NOT NULL DEFAULT 0,
  deferred_amount_cents     integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revenue_source_ref_check CHECK (
    (revenue_source = 'subscription' AND subscription_id IS NOT NULL) OR
    (revenue_source = 'commission' AND stripe_charge_id IS NOT NULL) OR
    (revenue_source = 'ad_reward' AND ad_impression_id IS NOT NULL)
  )
);

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admob_reconciliation_results (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date                 date NOT NULL,
  internal_impressions        integer NOT NULL DEFAULT 0,
  internal_earnings_usd_micros bigint NOT NULL DEFAULT 0,
  admob_impressions           integer,
  admob_earnings_usd_micros   bigint,
  admob_clicks                integer,
  admob_ecpm_usd_micros       bigint,
  impression_delta            integer,
  earnings_delta_usd_micros   bigint,
  delta_pct                   numeric(5,2),
  status                      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','matched','discrepancy','resolved','ignored')),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.abuse_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_type     text NOT NULL CHECK (flag_type IN ('rapid_claims','multi_ip','multi_device','vpn_detected','token_reuse')),
  severity      text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  details       jsonb,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_by   uuid REFERENCES auth.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rewarded_ad_config (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_rewarded_invoices_month integer NOT NULL DEFAULT 3,
  credits_per_reward          integer NOT NULL DEFAULT 1,
  credits_expire_at_period_end boolean NOT NULL DEFAULT true,
  min_seconds_between_ads     integer NOT NULL DEFAULT 300,
  max_ads_per_user_per_day    integer NOT NULL DEFAULT 5,
  enabled                     boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rewarded_ad_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─── Monthly credit reset ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reset_rewarded_credits_monthly()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_new_month_key text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  UPDATE public.rewarded_credits
  SET credits = 0, updated_at = now()
  WHERE month_key < v_new_month_key AND credits > 0;
END;
$$;
