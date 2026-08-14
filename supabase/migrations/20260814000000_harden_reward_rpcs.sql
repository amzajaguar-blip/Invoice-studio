-- ─────────────────────────────────────────────────────────────────────────────
-- Blindatura delle RPC che concedono entitlement
--
-- Il problema
-- ───────────
-- `atomic_apply_boost` e `grant_reward_document` sono `SECURITY DEFINER` — quindi
-- scavalcano la RLS — e avevano `EXECUTE` concesso ad `anon` e `authenticated`,
-- ma prendevano l'organizzazione da un PARAMETRO senza mai controllare
-- `auth.uid()`. Con la sola chiave anon estratta dall'APK, e senza nemmeno
-- effettuare il login, era possibile concedersi boost e crediti illimitati e
-- soprattutto assegnarli a organizzazioni altrui. Il vincolo UNIQUE su
-- `boost_callback_ids` non proteggeva nulla: il `callback_id` lo sceglie il
-- chiamante, e bastava cambiarlo a ogni richiesta.
--
-- La correzione
-- ─────────────
-- 1. `atomic_apply_boost` non accetta piu' l'organizzazione: la ricava da
--    `auth.uid()` su `org_members`. La vecchia firma a due argomenti viene
--    ELIMINATA, non affiancata: lasciarla significherebbe lasciare il buco.
-- 2. `grant_reward_document` conserva l'org come parametro, perche' la invoca la
--    Edge Function `reward-document-credit` con `service_role`, che non ha un
--    `auth.uid()` da cui dedurla. Perde pero' `EXECUTE` per `anon` e
--    `authenticated`: dal client non e' piu' raggiungibile.
--
-- Verifica eseguita in transazione poi annullata, su questo database:
--   proprietario autenticato ....... PERMESSO (boost applicato, +24h)
--   stesso callback_id due volte ... accettato senza duplicare (idempotenza)
--   vecchia firma con org libera ... eliminata
--   chiave anon .................... NEGATO (permission denied for function)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. atomic_apply_boost ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.atomic_apply_boost(uuid, text);

CREATE OR REPLACE FUNCTION public.atomic_apply_boost(p_callback_id text)
  RETURNS SETOF public.user_plan
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_org_id     uuid;
  v_plan_row   public.user_plan%ROWTYPE;
  v_today      DATE := CURRENT_DATE;
BEGIN
  -- ── 0. L'organizzazione la decide il server, non il chiamante.
  SELECT om.org_id INTO v_org_id
  FROM public.org_members om
  WHERE om.user_id = auth.uid() AND om.role = 'owner'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'nessuna organizzazione per l''utente autenticato';
  END IF;

  -- ── 1. Idempotenza: callback_id gia' visto, nessuna modifica.
  IF EXISTS (
    SELECT 1 FROM public.boost_callback_ids WHERE callback_id = p_callback_id
  ) THEN
    RETURN QUERY SELECT * FROM public.user_plan WHERE org_id = v_org_id;
    RETURN;
  END IF;

  -- ── 2. Lock della riga per evitare corse.
  SELECT * INTO v_plan_row
  FROM public.user_plan
  WHERE org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_plan non trovata per org_id %', v_org_id;
  END IF;

  -- ── 3. Registra il callback_id (UNIQUE: idempotenza anche in concorrenza).
  INSERT INTO public.boost_callback_ids (org_id, callback_id)
  VALUES (v_org_id, p_callback_id);

  -- ── 4. Applica il boost. Gli extra sono valori fissi, non additivi: un boost
  --       ripetuto sposta solo la scadenza.
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
  WHERE org_id = v_org_id;

  RETURN QUERY SELECT * FROM public.user_plan WHERE org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.atomic_apply_boost(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atomic_apply_boost(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_apply_boost(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_apply_boost(text) TO service_role;

-- ── 2. grant_reward_document: raggiungibile solo dal server ──────────────────

REVOKE ALL ON FUNCTION public.grant_reward_document(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_reward_document(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.grant_reward_document(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_reward_document(uuid) TO service_role;
