-- VELA Pivot: Expenses Table
-- Migration: 20250800000002_pivot_expenses.sql
-- Crea la tabella `expenses` per le note spese
-- Vincolo critico: nessuna modifica a organizations.plan o user_plan.plan

CREATE TABLE IF NOT EXISTS public.expenses (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_number    TEXT          NOT NULL,
  title            TEXT          NOT NULL,
  period_from      DATE          NOT NULL,
  period_to        DATE          NOT NULL,
  items            JSONB         NOT NULL DEFAULT '[]',
  total_by_category JSONB        NOT NULL DEFAULT '{}',
  grand_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT          NOT NULL DEFAULT 'EUR',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(org_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "expenses_org_owner" ON public.expenses FOR ALL
  USING (org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'owner' LIMIT 1
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
