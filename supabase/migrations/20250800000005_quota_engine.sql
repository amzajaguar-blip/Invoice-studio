-- Migration: 20250800000005_quota_engine.sql
-- Quota Engine — contatore documenti lifetime per piano gratuito
-- VINCOLO CRITICO: NON modifica organizations.plan, user_plan.plan, Rate_Limit_Engine, PlanContext

-- ─── Colonne quota su organizations ──────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS documents_generated_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_limit INTEGER NOT NULL DEFAULT 5;
-- NOTA: quota_limit default = 5 (DA CONFERMARE da Posky prima del deploy in produzione)

-- ─── Colonne reward da rewarded ad ───────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS documents_reward_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_reward_date DATE,
  ADD COLUMN IF NOT EXISTS daily_reward_count INTEGER NOT NULL DEFAULT 0;

-- ─── RPC atomica: increment_document_quota ────────────────────────────────────
-- Incrementa il contatore solo se la quota non è esaurita (considera anche i crediti reward).
-- Ritorna il nuovo valore di documents_generated_total, o NULL se quota esaurita.
-- Chiamata dal client dopo checkQuota restituisce allowed: true.
CREATE OR REPLACE FUNCTION public.increment_document_quota(org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_total INTEGER;
BEGIN
  UPDATE public.organizations
  SET documents_generated_total = documents_generated_total + 1
  WHERE id = org_id
    AND documents_generated_total < (quota_limit + documents_reward_credits)
  RETURNING documents_generated_total INTO new_total;
  RETURN new_total; -- NULL se UPDATE non ha trovato righe (quota esaurita)
END;
$$;

-- ─── RPC atomica: grant_reward_document ──────────────────────────────────────
-- Accredita +1 documento da rewarded ad, con rate limit giornaliero (max 3/giorno per org).
-- Chiamata SOLO dall'Edge Function reward-document-credit dopo verifica SSV lato server.
-- ANTI-PATTERN: NON chiamare questa funzione direttamente dal client mobile.
CREATE OR REPLACE FUNCTION public.grant_reward_document(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Reset contatore giornaliero se la data è cambiata
  UPDATE public.organizations
  SET daily_reward_count = 0,
      daily_reward_date = today
  WHERE id = org_id
    AND (daily_reward_date IS NULL OR daily_reward_date < today);

  -- Incrementa crediti solo se sotto il limite giornaliero (max 3)
  UPDATE public.organizations
  SET documents_reward_credits = documents_reward_credits + 1,
      daily_reward_count = daily_reward_count + 1
  WHERE id = org_id
    AND daily_reward_count < 3;

  RETURN FOUND; -- TRUE se il credito è stato aggiunto, FALSE se limite giornaliero raggiunto
END;
$$;
