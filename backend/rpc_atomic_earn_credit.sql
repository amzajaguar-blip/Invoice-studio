-- ============================================================================
-- InvoiceStudio — Atomic credit earn RPC (replaces client-side read-modify-write)
-- Run in Supabase SQL Editor
-- Fixes: P0 race condition in claimCredit() — SELECT→UPDATE on earned_credits
-- Date: 2026-05-25
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atomic_earn_credit(
  p_org_id       uuid,
  p_user_id      uuid,
  p_callback_id  text,
  p_ad_unit_id   text,
  p_reward_type  text DEFAULT 'invoice_credit',
  p_reward_amount integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_ad_impression_id uuid;
  v_existing_impression_id uuid;
  v_existing_status text;
  v_earned integer;
  v_consumed integer;
  v_balance_after integer;
  v_idempotency_key text;
  v_impression_error_code text;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 0: Pro guard — utenti Pro/Agency non hanno bisogno di crediti
  -- ═══════════════════════════════════════════════════════════════════════
  PERFORM 1 FROM public.subscriptions
   WHERE org_id = p_org_id
     AND plan IN ('pro', 'agency', 'enterprise')
     AND status IN ('active', 'trialing');

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'Pro users have unlimited invoices — credits not needed',
      'credits_granted', 0,
      'balance', 9999
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 1: Idempotency gate via ad_impressions (UNIQUE on admob_callback_id)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT id, verification_status
    INTO v_existing_impression_id, v_existing_status
    FROM public.ad_impressions
   WHERE admob_callback_id = p_callback_id;

  IF FOUND THEN
    -- Already processed — return existing balance
    SELECT earned_credits, consumed_credits
      INTO v_earned, v_consumed
      FROM public.org_credits
     WHERE org_id = p_org_id;

    v_balance_after := COALESCE(v_earned, 0) - COALESCE(v_consumed, 0);

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'ad_impression_id', v_existing_impression_id,
      'credits_granted', 0,
      'balance', v_balance_after
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 2: Insert ad_impressions (immutable, append-only per LAW 10)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO public.ad_impressions (
    org_id, user_id, admob_callback_id, ad_unit_id,
    reward_type, reward_amount, verification_status, verified_at
  ) VALUES (
    p_org_id, p_user_id, p_callback_id, p_ad_unit_id,
    p_reward_type, p_reward_amount, 'verified', now()
  )
  ON CONFLICT (admob_callback_id) DO NOTHING
  RETURNING id INTO v_ad_impression_id;

  -- If concurrent insert happened, bail out
  IF v_ad_impression_id IS NULL THEN
    SELECT earned_credits, consumed_credits
      INTO v_earned, v_consumed
      FROM public.org_credits
     WHERE org_id = p_org_id;

    v_balance_after := COALESCE(v_earned, 0) - COALESCE(v_consumed, 0);

    RETURN jsonb_build_object(
      'status', 'duplicate_race',
      'credits_granted', 0,
      'balance', v_balance_after
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 3: Atomic increment earned_credits (no read-modify-write race)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO public.org_credits (org_id, earned_credits, consumed_credits)
  VALUES (p_org_id, p_reward_amount, 0)
  ON CONFLICT (org_id) DO UPDATE
    SET earned_credits = org_credits.earned_credits + p_reward_amount,
        updated_at = now()
  RETURNING earned_credits, consumed_credits
    INTO v_earned, v_consumed;

  v_balance_after := v_earned - v_consumed;

  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 4: Insert credit_transactions ledger entry (append-only)
  -- ═══════════════════════════════════════════════════════════════════════
  v_idempotency_key := 'earn_' || p_callback_id || '_' || p_org_id::text;

  INSERT INTO public.credit_transactions (
    org_id, entry_type, amount, ad_impression_id,
    idempotency_key, balance_after, reason
  ) VALUES (
    p_org_id, 'earn', p_reward_amount, v_ad_impression_id,
    v_idempotency_key, v_balance_after,
    'Rewarded ad watched (atomic RPC)'
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- STEP 5: Insert revenue_events (unified revenue ledger)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO public.revenue_events (
    org_id, revenue_source, amount_cents, currency,
    ad_impression_id, recognition_period_start
  ) VALUES (
    p_org_id, 'ad_reward', 0, 'EUR',  -- amount tracked separately in AdMob
    v_ad_impression_id, CURRENT_DATE
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'ad_impression_id', v_ad_impression_id,
    'credits_granted', p_reward_amount,
    'balance', v_balance_after
  );
END;
$$;
