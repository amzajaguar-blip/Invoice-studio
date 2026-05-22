-- ============================================================================
-- InvoiceStudio — Rewarded Ads Migration (Phase 1: EXPAND)
-- Run in Supabase SQL Editor
-- Project: xiqebgohgwbbzynhisah
-- Date: 2026-05-19
-- ============================================================================
-- Per LAW 07: This migration only ADDS new tables/columns.
-- No existing columns are dropped or modified.
-- Rollback script at the bottom.
-- ============================================================================

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. org_credits — Credit wallet per organization
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.org_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  earned_credits      integer NOT NULL DEFAULT 0 CHECK (earned_credits >= 0),
  consumed_credits    integer NOT NULL DEFAULT 0 CHECK (consumed_credits >= 0),
  current_period_start date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  current_period_end   date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

COMMENT ON TABLE public.org_credits IS 'Credit wallet: 1 credit = 1 extra invoice on free plan. Credits expire at end of billing period.';

ALTER TABLE public.org_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_tenant_select" ON public.org_credits
  FOR SELECT USING (org_id = current_org_id());

CREATE POLICY "credits_tenant_insert" ON public.org_credits
  FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE INDEX idx_org_credits_org_id ON public.org_credits(org_id);

CREATE TRIGGER trg_org_credits_updated_at
  BEFORE UPDATE ON public.org_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ad_impressions — Append-only ad impression ledger (LAW 10)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.ad_impressions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admob_callback_id     text UNIQUE NOT NULL,
  ad_unit_id            text NOT NULL,
  reward_type           text NOT NULL DEFAULT 'invoice_credit',
  reward_amount         integer NOT NULL DEFAULT 1 CHECK (reward_amount > 0),
  verification_status   text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'duplicate')),
  verified_at           timestamptz,
  estimated_earnings_usd_micros bigint,
  ip_address            text,
  user_agent_hash       text,
  device_fingerprint    text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ad_impressions IS 'Append-only ledger of every rewarded ad impression. No UPDATE or DELETE per LAW 10.';

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_impressions_tenant_select" ON public.ad_impressions
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_ad_impressions_org_id ON public.ad_impressions(org_id);
CREATE INDEX idx_ad_impressions_admob_callback ON public.ad_impressions(admob_callback_id);
CREATE INDEX idx_ad_impressions_created_at ON public.ad_impressions(created_at);
CREATE INDEX idx_ad_impressions_verification ON public.ad_impressions(verification_status)
  WHERE verification_status = 'pending';

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. credit_transactions — Double-entry credit ledger (LAW 10)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.credit_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_type        text NOT NULL CHECK (entry_type IN ('earn', 'consume', 'expire', 'refund')),
  amount            integer NOT NULL CHECK (amount > 0),
  ad_impression_id  uuid REFERENCES public.ad_impressions(id),
  invoice_id        uuid REFERENCES public.invoices(id),
  idempotency_key   text UNIQUE NOT NULL,
  balance_after     integer NOT NULL,
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_transactions IS 'Immutable double-entry ledger. No UPDATE or DELETE per LAW 10.';

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_tx_tenant_select" ON public.credit_transactions
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_credit_tx_org_id ON public.credit_transactions(org_id);
CREATE INDEX idx_credit_tx_idempotency ON public.credit_transactions(idempotency_key);
CREATE INDEX idx_credit_tx_type ON public.credit_transactions(entry_type);
CREATE INDEX idx_credit_tx_created_at ON public.credit_transactions(created_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. revenue_events — Unified revenue ledger (LAW 10)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.revenue_events (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  revenue_source            text NOT NULL CHECK (revenue_source IN ('subscription', 'commission', 'ad_reward')),
  amount_cents              integer NOT NULL,
  currency                  text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD')),
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

COMMENT ON TABLE public.revenue_events IS 'Unified revenue journal — append only per LAW 10.';

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_tenant_select" ON public.revenue_events
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_revenue_events_org_id ON public.revenue_events(org_id);
CREATE INDEX idx_revenue_events_source ON public.revenue_events(revenue_source);
CREATE INDEX idx_revenue_events_created_at ON public.revenue_events(created_at);
CREATE INDEX idx_revenue_events_period ON public.revenue_events(recognition_period_start, recognition_period_end);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. rewarded_ad_config — Admin-controlled limits (singleton)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.rewarded_ad_config (
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

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. abuse_flags — Fraud detection audit trail
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.abuse_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_type     text NOT NULL CHECK (flag_type IN ('rapid_claims', 'multi_ip', 'multi_device', 'vpn_detected', 'token_reuse')),
  severity      text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details       jsonb,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_by   uuid REFERENCES auth.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_abuse_flags_org_id ON public.abuse_flags(org_id);
CREATE INDEX idx_abuse_flags_resolved ON public.abuse_flags(resolved) WHERE resolved = false;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. admob_reconciliation_results — AdMob payout reconciliation
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.admob_reconciliation_results (
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
    CHECK (status IN ('pending', 'matched', 'discrepancy', 'resolved', 'ignored')),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_admob_reconciliation_date ON public.admob_reconciliation_results(report_date);

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Extend invoice_events event_type to include rewarded_credit_used
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.invoice_events
  DROP CONSTRAINT IF EXISTS invoice_events_event_type_check;

ALTER TABLE public.invoice_events
  ADD CONSTRAINT invoice_events_event_type_check
  CHECK (event_type IN (
    'created', 'sent', 'opened', 'paid', 'reminder_sent', 'cancelled', 'viewed',
    'rewarded_credit_used'
  ));

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Index for monthly invoice count queries (quota enforcement)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_invoices_org_month
  ON public.invoices(org_id, (date_trunc('month', created_at)::date))
  WHERE deleted_at IS NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Stored procedure: Atomic credit reset on 1st of each month
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reset_org_credits_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_start  date := date_trunc('month', CURRENT_DATE)::date;
  v_period_end    date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_org           RECORD;
  v_expired_key   text;
  v_expired_credits integer;
BEGIN
  FOR v_org IN
    SELECT oc.id, oc.org_id, oc.earned_credits, oc.consumed_credits
    FROM public.org_credits oc
    WHERE oc.current_period_end < v_period_start
  LOOP
    v_expired_credits := v_org.earned_credits - v_org.consumed_credits;

    IF v_expired_credits > 0 THEN
      v_expired_key := 'expire_' || v_org.org_id || '_' || to_char(CURRENT_DATE, 'YYYYMMDD');

      INSERT INTO public.credit_transactions (
        org_id, entry_type, amount, idempotency_key, balance_after, reason
      ) VALUES (
        v_org.org_id,
        'expire',
        v_expired_credits,
        v_expired_key,
        0,
        'Monthly credit reset — credits do not roll over'
      );
    END IF;

    UPDATE public.org_credits
    SET earned_credits = 0,
        consumed_credits = 0,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        updated_at = now()
    WHERE id = v_org.id;
  END LOOP;

  -- Update any org_credits rows that exist but had zero balance
  UPDATE public.org_credits
  SET current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = now()
  WHERE current_period_end < v_period_start;
END;
$$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (run only after 2 full deploy cycles with zero reads)
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.reset_org_credits_period() CASCADE;
-- DROP TABLE IF EXISTS public.admob_reconciliation_results CASCADE;
-- DROP TABLE IF EXISTS public.abuse_flags CASCADE;
-- DROP TABLE IF EXISTS public.rewarded_ad_config CASCADE;
-- DROP TABLE IF EXISTS public.revenue_events CASCADE;
-- DROP TABLE IF EXISTS public.credit_transactions CASCADE;
-- DROP TABLE IF EXISTS public.ad_impressions CASCADE;
-- DROP TABLE IF EXISTS public.org_credits CASCADE;
-- DROP INDEX IF EXISTS idx_invoices_org_month;
-- ALTER TABLE public.invoice_events
--   DROP CONSTRAINT IF EXISTS invoice_events_event_type_check;
-- ALTER TABLE public.invoice_events
--   ADD CONSTRAINT invoice_events_event_type_check
--   CHECK (event_type IN ('created','sent','opened','paid','reminder_sent','cancelled','viewed'));
-- COMMIT;
