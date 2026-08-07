-- Migration: 20260801000001_rls_organizations.sql
-- RLS su public.organizations — ALLINEATA allo stato live di produzione (verificato 2026-08-06).
--
-- Storia: la protezione è stata applicata in produzione out-of-band (SQL Editor)
-- con policy basate sulla funzione helper current_org_id() — implementazione
-- preferita rispetto alla versione originaria di questo file (subquery diretta su
-- org_members dentro la policy): niente ricorsione RLS, pattern STABLE SECURITY DEFINER.
-- Questo file riflette esattamente lo stato live, in forma idempotente.
--
-- Protegge documents_generated_total, quota_limit, documents_reward_credits
-- da letture cross-tenant con anon key.

-- Helper: org_id dell'utente corrente (SECURITY DEFINER → le policy non triggerano
-- RLS su org_members; STABLE → cached per statement; search_path vuoto → hardening)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$function$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: solo la propria org
DROP POLICY IF EXISTS "org_owner_select" ON public.organizations;
CREATE POLICY "org_owner_select"
  ON public.organizations
  FOR SELECT
  USING (id = current_org_id());

-- UPDATE: solo la propria org (colonne quota aggiornate dalle RPC SECURITY DEFINER)
DROP POLICY IF EXISTS "org_owner_update" ON public.organizations;
CREATE POLICY "org_owner_update"
  ON public.organizations
  FOR UPDATE
  USING (id = current_org_id());

-- Convergenza: rimuove le policy della versione originaria se applicate altrove
DROP POLICY IF EXISTS "org_members_can_read_organizations" ON public.organizations;
DROP POLICY IF EXISTS "org_members_can_update_organizations" ON public.organizations;

-- INSERT: nessuna policy per authenticated — creazione org via trigger
-- handle_new_user() (SECURITY DEFINER). DELETE: solo service role.

-- VERIFICA (SQL Editor):
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public' AND tablename='organizations';  -- → true
-- SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy
-- WHERE polrelid='public.organizations'::regclass;          -- → 2 policy, id = current_org_id()
