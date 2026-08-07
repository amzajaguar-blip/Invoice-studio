-- VELA Pivot Prodotto — Tabella reminders
-- Migration: 20250800000003_pivot_reminders.sql
--
-- VINCOLO: questo file NON modifica organizations.plan né user_plan.plan.
-- Crea solo la tabella public.reminders con RLS e trigger updated_at.

-- Drop and recreate to ensure correct schema (idempotent for dev)
DROP TABLE IF EXISTS public.reminders CASCADE;

CREATE TABLE public.reminders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  notes            TEXT,
  due_date         TIMESTAMPTZ NOT NULL,
  recurrence       TEXT        NOT NULL DEFAULT 'once'
                               CHECK (recurrence IN ('once', 'monthly', 'yearly')),
  notification_id  TEXT,
  completed        BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_org ON public.reminders(org_id);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "reminders_org_owner" ON public.reminders FOR ALL
  USING (org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'owner' LIMIT 1
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_reminders_updated_at ON public.reminders;
CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
