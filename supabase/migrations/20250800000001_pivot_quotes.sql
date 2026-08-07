-- VELA Pivot Prodotto: tabella quotes con client_snapshot e line_items JSONB
-- Task 1.2 — Migrazione quotes per il pivot prodotto

CREATE TABLE IF NOT EXISTS public.quotes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_number     TEXT          NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'invoiced')),
  issue_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE          NOT NULL,
  client_id        UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  client_snapshot  JSONB         NOT NULL,
  line_items       JSONB         NOT NULL DEFAULT '[]',
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  template_id      TEXT,
  converted_to_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON public.quotes(org_id);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "quotes_org_owner" ON public.quotes FOR ALL
  USING (org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'owner' LIMIT 1
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
