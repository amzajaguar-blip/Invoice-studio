-- ============================================================================
-- InvoiceStudio — RLS Fix for Rewarded Ads (mobile direct writes)
-- SECONDO FILE DA ESEGUIRE (dopo migration-rewarded-ads.sql)
-- Aggiunge i permessi mancanti per UPDATE/INSERT lato mobile
-- Run in Supabase SQL Editor
-- Date: 2026-05-25
-- ============================================================================

BEGIN;

-- 1. Allow mobile claimCredit to UPDATE org_credits (earned_credits increment)
DO $$ BEGIN
  CREATE POLICY "credits_tenant_update" ON public.org_credits
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow mobile claimCredit to INSERT credit_transactions (ledger entries)
DO $$ BEGIN
  CREATE POLICY "credit_tx_tenant_insert" ON public.credit_transactions
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Allow mobile claimCredit to INSERT ad_impressions (idempotency gate)
DO $$ BEGIN
  CREATE POLICY "ad_impressions_tenant_insert" ON public.ad_impressions
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Allow revenue_events INSERT (for ad_reward revenue recognition)
DO $$ BEGIN
  CREATE POLICY "revenue_tenant_insert" ON public.revenue_events
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Allow org_credits DELETE (for monthly reset procedure)
DO $$ BEGIN
  CREATE POLICY "credits_tenant_delete" ON public.org_credits
    FOR DELETE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
