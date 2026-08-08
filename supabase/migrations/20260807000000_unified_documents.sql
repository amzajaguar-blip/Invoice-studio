-- MILO OFFICE — Fase A: Tabella unificata documents (v2 — schema reale)
-- Backup: .debug/backup-20260807-230910/ (34 invoices, 0 quotes)

-- =============================================================================
-- 1. CREA TABELLA documents
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type    TEXT          NOT NULL DEFAULT 'invoice'
                                 CHECK (document_type IN ('invoice', 'quote', 'contract', 'letter', 'report', 'custom')),
  number           TEXT          NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'draft',
  client_id        UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  client_snapshot  JSONB,
  issue_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  valid_until      DATE,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT          NOT NULL DEFAULT 'EUR',
  notes            TEXT,
  payment_terms    TEXT,
  withholding_tax_rate NUMERIC(5,2) DEFAULT 0,
  template_id      TEXT,
  converted_from_quote_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  paid_at          TIMESTAMPTZ,
  payment_link     TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_documents_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. CREA TABELLA document_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID          NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  description   TEXT          NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,2)  DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_items_doc ON public.document_items(document_id);

-- =============================================================================
-- 3. RLS su documents
-- =============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "documents_org_owner" ON public.documents FOR ALL
  USING (org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'owner' LIMIT 1
  ))
  WITH CHECK (org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'owner' LIMIT 1
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. MIGRA DATI: invoices → documents (type='invoice')
-- =============================================================================

INSERT INTO public.documents (
  id, org_id, document_type, number, status,
  client_id, issue_date, due_date,
  subtotal, tax_rate,
  tax_amount,
  discount_amount,
  total,
  currency, notes,
  withholding_tax_rate,
  paid_at, payment_link,
  deleted_at, created_at, updated_at
)
SELECT
  id, org_id, 'invoice', number, status,
  client_id, issue_date, due_date,
  subtotal, tax_rate,
  COALESCE(subtotal * (tax_rate / 100), 0) AS tax_amount,
  0 AS discount_amount,
  total,
  currency, notes,
  withholding_tax_rate,
  paid_at, payment_link,
  deleted_at, created_at, updated_at
FROM public.invoices
WHERE deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 5. MIGRA DATI: invoice_items → document_items
-- =============================================================================

INSERT INTO public.document_items (document_id, description, quantity, unit_price, tax_rate)
SELECT invoice_id, description, quantity, unit_price, tax_rate
FROM public.invoice_items
WHERE invoice_id IN (SELECT id FROM public.documents WHERE document_type = 'invoice')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. MIGRA DATI: quotes → documents (type='quote')
-- =============================================================================

INSERT INTO public.documents (
  id, org_id, document_type, number, status,
  client_id, issue_date, due_date,
  subtotal, tax_rate,
  tax_amount,
  discount_amount,
  total,
  currency, notes,
  deleted_at, created_at, updated_at
)
SELECT
  id, org_id, 'quote', number, status,
  client_id, issue_date, due_date,
  subtotal, tax_rate,
  COALESCE(subtotal * (tax_rate / 100), 0) AS tax_amount,
  0 AS discount_amount,
  total,
  currency, notes,
  deleted_at, created_at, updated_at
FROM public.quotes
WHERE deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. VERIFICA CONTEggi
-- =============================================================================

DO $$
DECLARE
  inv_original INTEGER;
  quo_original INTEGER;
  doc_invoice INTEGER;
  doc_quote   INTEGER;
BEGIN
  SELECT COUNT(*) INTO inv_original FROM public.invoices WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO quo_original FROM public.quotes WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO doc_invoice FROM public.documents WHERE document_type = 'invoice' AND deleted_at IS NULL;
  SELECT COUNT(*) INTO doc_quote   FROM public.documents WHERE document_type = 'quote' AND deleted_at IS NULL;
  
  RAISE NOTICE '====== VERIFICA MIGRAZIONE ======';
  RAISE NOTICE 'invoices originali: %  →  documents (invoice): %', inv_original, doc_invoice;
  RAISE NOTICE 'quotes originali:    %  →  documents (quote):   %', quo_original, doc_quote;
  
  IF inv_original = doc_invoice AND quo_original = doc_quote THEN
    RAISE NOTICE '✅ MIGRAZIONE RIUSCITA: tutti i conteggi combaciano';
  ELSE
    RAISE EXCEPTION '❌ DISCREPANZA: invoices % vs %, quotes % vs %', inv_original, doc_invoice, quo_original, doc_quote;
  END IF;
END $$;
