-- ============================================================================
-- InvoiceStudio — RLS Policies for Rewarded Ads tables
-- Run AFTER migration_rewarded_ads.sql
-- Safe to re-run (idempotent).
-- ============================================================================

-- Suppress policy-already-exists errors
SET client_min_messages TO WARNING;

DO $$ BEGIN
  CREATE POLICY "rewarded_credits_select" ON public.rewarded_credits
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "rewarded_credits_insert" ON public.rewarded_credits
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "rewarded_credits_update" ON public.rewarded_credits
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reward_claims_select" ON public.reward_claims
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reward_claims_insert" ON public.reward_claims
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ad_impressions_tenant_select" ON public.ad_impressions
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "revenue_tenant_select" ON public.revenue_events
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

RESET client_min_messages;
