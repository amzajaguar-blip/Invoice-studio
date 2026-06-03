-- ============================================================================
-- InvoiceStudio — OCR Intake Engine V21
-- Project: xiqebgohgwbbzynhisah
-- Adds invoice_ocr_jobs (track uploaded invoice files for OCR processing)
-- and invoice_ocr_results (extracted field values with per-field confidence).
-- Run this in the Supabase SQL Editor (after migration.sql)
-- ============================================================================

-- ─── invoice_ocr_jobs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_ocr_jobs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_url    text NOT NULL,                                          -- URL in Supabase Storage bucket
  file_name   text,                                                   -- original filename for display
  status      text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  confidence  integer,                                                -- overall confidence 0-100
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_ocr_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ocr_jobs_tenant_select" ON public.invoice_ocr_jobs
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ocr_jobs_tenant_insert" ON public.invoice_ocr_jobs
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ocr_jobs_tenant_update" ON public.invoice_ocr_jobs
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── invoice_ocr_results ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_ocr_results (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                    uuid NOT NULL REFERENCES public.invoice_ocr_jobs(id) ON DELETE CASCADE,
  supplier_name             text,
  vat_number                text,
  invoice_number            text,
  invoice_date              date,
  taxable_amount            numeric(12,2),
  vat_amount                numeric(12,2),
  total_amount              numeric(12,2),
  currency                  text DEFAULT 'EUR',
  raw_text                  text,
  -- per-field confidence scores (0-100)
  confidence_supplier_name  integer,
  confidence_vat_number     integer,
  confidence_invoice_number integer,
  confidence_invoice_date   integer,
  confidence_total_amount   integer,
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_ocr_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ocr_results_tenant_select" ON public.invoice_ocr_results
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoice_ocr_jobs WHERE id = invoice_ocr_results.job_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ocr_results_tenant_insert" ON public.invoice_ocr_results
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoice_ocr_jobs WHERE id = invoice_ocr_results.job_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ocr_results_tenant_update" ON public.invoice_ocr_results
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.invoice_ocr_jobs WHERE id = invoice_ocr_results.job_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_ocr_jobs_org_id     ON public.invoice_ocr_jobs(org_id);
CREATE INDEX idx_ocr_jobs_status     ON public.invoice_ocr_jobs(status);
CREATE INDEX idx_ocr_jobs_created_at ON public.invoice_ocr_jobs(created_at);
CREATE INDEX idx_ocr_results_job_id  ON public.invoice_ocr_results(job_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

-- Reuse / safely recreate the standard update_updated_at() helper (also defined in migration.sql)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ocr_jobs_updated_at
  BEFORE UPDATE ON public.invoice_ocr_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
