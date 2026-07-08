-- ============================================================================
-- InvoiceStudio — Full Database Migration
-- Project: xiqebgohgwbbzynhisah
-- Region: eu-central-1 (must be verified in Supabase dashboard)
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgsodium";

-- ─── organizations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  logo_url    text,
  brand_color text,
  stripe_account_id text,
  plan        text NOT NULL DEFAULT 'free',
  iban        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policies for organizations — defined AFTER current_org_id() below

-- ─── org_members ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ─── Helper: current_org_id() ─────────────────────────────────────────────────
-- Returns the org_id of the currently authenticated user.
-- Used by all RLS policies for tenant isolation.
-- MUST be defined AFTER org_members table and BEFORE any policies that reference it.

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─── Policies for organizations (function exists now) ─────────────────────────

DO $$ BEGIN
  CREATE POLICY "org_owner_select" ON public.organizations
    FOR SELECT USING (id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org_owner_update" ON public.organizations
    FOR UPDATE USING (id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Policies for org_members ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "org_members_select" ON public.org_members
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org_members_insert" ON public.org_members
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org_members_update" ON public.org_members
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── clients ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL,
  vat_number text,
  address    text,
  currency   text NOT NULL DEFAULT 'EUR',
  phone      text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "clients_tenant_select" ON public.clients
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "clients_tenant_insert" ON public.clients
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "clients_tenant_update" ON public.clients
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "clients_tenant_delete" ON public.clients
    FOR DELETE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── invoices ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id            uuid NOT NULL REFERENCES public.clients(id),
  number               text NOT NULL,                  -- e.g. "INV-2026-001"
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'overdue', 'paid', 'cancelled')),
  issue_date           date NOT NULL DEFAULT CURRENT_DATE,
  due_date             date NOT NULL,
  subtotal             numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate             numeric(5,2) NOT NULL DEFAULT 22,
  withholding_tax_rate numeric(5,2) NOT NULL DEFAULT 0, -- Italian ritenuta d'acconto
  total                numeric(12,2) NOT NULL DEFAULT 0,
  currency             text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP', 'CHF')),
  notes                text,
  payment_link         text,                           -- Stripe Checkout URL
  paid_at              timestamptz,
  deleted_at           timestamptz,                    -- soft delete
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "invoices_tenant_select" ON public.invoices
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_tenant_insert" ON public.invoices
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_tenant_update" ON public.invoices
    FOR UPDATE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_tenant_delete" ON public.invoices
    FOR DELETE USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── invoice_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate    numeric(5,2) NOT NULL DEFAULT 22,       -- per-item VAT (Italian law: some items 22%, 4%, exempt)
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "items_tenant_select" ON public.invoice_items
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "items_tenant_insert" ON public.invoice_items
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "items_tenant_update" ON public.invoice_items
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "items_tenant_delete" ON public.invoice_items
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── invoice_events (audit trail) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'sent', 'opened', 'paid', 'reminder_sent', 'cancelled', 'viewed')),
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "events_tenant_select" ON public.invoice_events
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_events.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "events_tenant_insert" ON public.invoice_events
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_events.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── email_templates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('invoice_sent', 'payment_received', 'reminder', 'welcome')),
  subject    text NOT NULL,
  body_html  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "templates_tenant_select" ON public.email_templates
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "templates_tenant_all" ON public.email_templates
    FOR ALL USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── reminders ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at     timestamptz,
  cancelled   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "reminders_tenant_select" ON public.reminders
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = reminders.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reminders_tenant_all" ON public.reminders
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = reminders.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── payment_tokens ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,        -- SHA-256 of the 256-bit random token
  stripe_pi_id text,                      -- Stripe PaymentIntent ID
  expires_at timestamptz DEFAULT (now() + INTERVAL '30 days'),
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tokens_tenant_select" ON public.payment_tokens
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = payment_tokens.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tokens_tenant_insert" ON public.payment_tokens
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoices WHERE id = payment_tokens.invoice_id AND org_id = current_org_id())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan               text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency', 'enterprise')),
  stripe_sub_id      text,
  stripe_customer_id text,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "subs_tenant_select" ON public.subscriptions
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── audit_logs (compliance) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  changes     jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "audit_tenant_select" ON public.audit_logs
    FOR SELECT USING (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "audit_tenant_insert" ON public.audit_logs
    FOR INSERT WITH CHECK (org_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_number_org_unique UNIQUE (org_id, number);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_id ON public.invoice_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice_id ON public.reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON public.reminders(scheduled_for) WHERE sent_at IS NULL AND cancelled = false;
CREATE INDEX IF NOT EXISTS idx_payment_tokens_invoice_id ON public.payment_tokens(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_hash ON public.payment_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

-- Auto-update updated_at on organizations
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── New user → auto-create organization ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Create organization
  INSERT INTO public.organizations (name, plan)
  VALUES (NEW.raw_user_meta_data->>'full_name' || '''s Studio', 'free')
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  -- Create default user_plan (V34)
  INSERT INTO public.user_plan (org_id, user_id, plan)
  VALUES (v_org_id, NEW.id, 'free');

  -- Create default user_engagement (V34)
  INSERT INTO public.user_engagement (org_id, user_id)
  VALUES (v_org_id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Invoice status → overdue automations ─────────────────────────────────────
-- When an invoice is 'sent' and due_date < now(), mark it as 'overdue'.
-- This is a safety net; the primary logic should be in a scheduled job.

CREATE OR REPLACE FUNCTION public.check_overdue_invoices()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'sent' AND due_date < CURRENT_DATE;
$$;

-- ─── Storage buckets ──────────────────────────────────────────────────────────
-- Run these via Supabase dashboard or Storage API

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES
--   ('logos', 'logos', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/svg+xml']),
--   ('pdfs', 'pdfs', false, 26214400, ARRAY['application/pdf']);

-- Storage RLS for PDFs:
-- CREATE POLICY "pdfs_tenant_select" ON storage.objects
--   FOR SELECT USING (bucket_id = 'pdfs' AND (storage.foldername(name))[1] = current_org_id()::text);
