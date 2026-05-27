-- ============================================================
-- V16 Migration: user_push_tokens + payment_audit_logs
-- Run via: Supabase Dashboard → SQL Editor, or supabase db push
-- ============================================================

-- ─── user_push_tokens ──────────────────────────────────────
-- Stores Expo push tokens for mobile push notification delivery.
-- One row per user (upserted on conflict).

create table if not exists public.user_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('android', 'ios')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

-- Only the token owner can read/write their own token
alter table public.user_push_tokens enable row level security;

create policy "Users can manage their own push token"
  on public.user_push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── payment_audit_logs ────────────────────────────────────
-- PCI-DSS compliant audit log for all payment webhook events.
-- NEVER stores card data, raw payloads, or secrets.

create table if not exists public.payment_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null,
  provider          text not null check (provider in ('stripe', 'revenuecat')),
  invoice_id        uuid references public.invoices(id) on delete set null,
  org_id            uuid references public.organizations(id) on delete set null,
  external_event_id text,
  environment       text not null check (environment in ('sandbox', 'production', 'unknown')),
  outcome           text not null check (outcome in ('success', 'failure', 'ignored')),
  error_code        text,
  created_at        timestamptz not null default now()
);

-- Audit logs are write-only from server side (service role).
-- No RLS policies — access only via service role key (admin client).
alter table public.payment_audit_logs enable row level security;

-- Index for fast lookups by invoice and org
create index if not exists idx_payment_audit_invoice_id on public.payment_audit_logs (invoice_id);
create index if not exists idx_payment_audit_org_id on public.payment_audit_logs (org_id);
create index if not exists idx_payment_audit_created_at on public.payment_audit_logs (created_at desc);

-- ─── daily_earned_credits (backfill from V12 if not exists) ─
alter table public.user_quotas
  add column if not exists daily_earned_credits int default 0,
  add column if not exists daily_period_date date;
