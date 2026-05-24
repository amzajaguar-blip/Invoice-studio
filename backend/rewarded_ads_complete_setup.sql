-- ============================================================================
-- InvoiceStudio — Rewarded Ads: Script COMPLETO + IDEMPOTENTE
-- Crea tabelle + RLS + RPC atomica in una sola esecuzione sicura.
-- Puoi eseguire questo script più volte: non darà errori.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Crea tabella org_credits (wallet crediti per organizzazione)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_credits (
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

ALTER TABLE public.org_credits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_credits_org_id ON public.org_credits(org_id);

-- Trigger updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_org_credits_updated_at
    BEFORE UPDATE ON public.org_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Crea tabella ad_impressions (ledger annunci visti)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ad_impressions (
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

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ad_impressions_org_id ON public.ad_impressions(org_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_admob_callback ON public.ad_impressions(admob_callback_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created_at ON public.ad_impressions(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Crea tabella credit_transactions (ledger movimenti crediti)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_transactions (
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

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_credit_tx_org_id ON public.credit_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_idempotency ON public.credit_transactions(idempotency_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Crea tabella revenue_events (entrate da ads)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.revenue_events (
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
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_revenue_events_org_id ON public.revenue_events(org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_source ON public.revenue_events(revenue_source);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Crea tabella rewarded_ad_config (configurazione limiti ads)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Index mensile sulle fatture (per contare quota mese)
-- ─────────────────────────────────────────────────────────────────────────────

-- NB: date_trunc() is STABLE, not IMMUTABLE, so it cannot be used in an index
-- expression. A composite index on (org_id, created_at) covers the monthly
-- quota query just as efficiently with a range scan.
CREATE INDEX IF NOT EXISTS idx_invoices_org_created
  ON public.invoices(org_id, created_at)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Estendi invoice_events per supportare 'rewarded_credit_used'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.invoice_events
  DROP CONSTRAINT IF EXISTS invoice_events_event_type_check;

ALTER TABLE public.invoice_events
  ADD CONSTRAINT invoice_events_event_type_check
  CHECK (event_type IN (
    'created', 'sent', 'opened', 'paid', 'reminder_sent', 'cancelled', 'viewed',
    'rewarded_credit_used'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Policy RLS per org_credits (tutte: SELECT, INSERT, UPDATE, DELETE)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "credits_tenant_select" ON public.org_credits
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "credits_tenant_insert" ON public.org_credits
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "credits_tenant_update" ON public.org_credits
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "credits_tenant_delete" ON public.org_credits
    FOR DELETE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: Policy RLS per ad_impressions
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "ad_impressions_tenant_select" ON public.ad_impressions
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ad_impressions_tenant_insert" ON public.ad_impressions
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: Policy RLS per credit_transactions
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "credit_tx_tenant_select" ON public.credit_transactions
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "credit_tx_tenant_insert" ON public.credit_transactions
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11: Policy RLS per revenue_events
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "revenue_tenant_select" ON public.revenue_events
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "revenue_tenant_insert" ON public.revenue_events
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 12: Funzione RPC atomica atomic_earn_credit()
-- Sostituisce il read-modify-write lato client (elimina race condition P0)
-- ─────────────────────────────────────────────────────────────────────────────

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
BEGIN
  -- STEP A: Idempotency gate — controlla se il callback è già stato processato
  SELECT id, verification_status
    INTO v_existing_impression_id, v_existing_status
    FROM public.ad_impressions
   WHERE admob_callback_id = p_callback_id;

  IF FOUND THEN
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

  -- STEP B: Registra l'impressione (append-only, idempotente)
  INSERT INTO public.ad_impressions (
    org_id, user_id, admob_callback_id, ad_unit_id,
    reward_type, reward_amount, verification_status, verified_at
  ) VALUES (
    p_org_id, p_user_id, p_callback_id, p_ad_unit_id,
    p_reward_type, p_reward_amount, 'verified', now()
  )
  ON CONFLICT (admob_callback_id) DO NOTHING
  RETURNING id INTO v_ad_impression_id;

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

  -- STEP C: Incremento atomico earned_credits (upsert, nessuna race condition)
  INSERT INTO public.org_credits (org_id, earned_credits, consumed_credits)
  VALUES (p_org_id, p_reward_amount, 0)
  ON CONFLICT (org_id) DO UPDATE
    SET earned_credits = org_credits.earned_credits + p_reward_amount,
        updated_at = now()
  RETURNING earned_credits, consumed_credits
    INTO v_earned, v_consumed;

  v_balance_after := v_earned - v_consumed;

  -- STEP D: Ledger credit_transactions (append-only)
  v_idempotency_key := 'earn_' || p_callback_id || '_' || p_org_id::text;

  INSERT INTO public.credit_transactions (
    org_id, entry_type, amount, ad_impression_id,
    idempotency_key, balance_after, reason
  ) VALUES (
    p_org_id, 'earn', p_reward_amount, v_ad_impression_id,
    v_idempotency_key, v_balance_after,
    'Rewarded ad watched (atomic RPC)'
  );

  -- STEP E: Revenue event (ad_reward)
  INSERT INTO public.revenue_events (
    org_id, revenue_source, amount_cents, currency,
    ad_impression_id, recognition_period_start
  ) VALUES (
    p_org_id, 'ad_reward', 0, 'EUR',
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

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 13: Funzione reset mensile crediti
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_expired_credits integer;
  v_expired_key   text;
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
        v_org.org_id, 'expire', v_expired_credits, v_expired_key, 0,
        'Monthly credit reset — credits do not roll over'
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.org_credits
    SET earned_credits = 0,
        consumed_credits = 0,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        updated_at = now()
    WHERE id = v_org.id;
  END LOOP;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICA: esegui queste query per confermare che tutto è andato bene
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN
--   ('org_credits','ad_impressions','credit_transactions','revenue_events','rewarded_ad_config');
--
-- SELECT policyname, tablename, cmd FROM pg_policies
--   WHERE tablename IN ('org_credits','ad_impressions','credit_transactions','revenue_events');
--
-- SELECT proname FROM pg_proc WHERE proname IN ('atomic_earn_credit','reset_org_credits_period');
