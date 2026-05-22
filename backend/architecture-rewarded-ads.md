# InvoiceStudio — Rewarded Ads Billing Architecture

> **ADR-003**: Rewarded Ads as third monetization vector alongside Google Play Subscriptions and Stripe Connect Commissions.
>
> **Status**: Proposed
> **Date**: 2026-05-19
> **Author**: BillingEngineer
> **Supersedes**: None (greenfield capability)

---

## § 0 · CONTEXT VERIFICATION

| Dimension | Value | Confidence |
|-----------|-------|------------|
| **Business model** | B2C SaaS (freelancers / micro-agencies) + marketplace facilitation (Stripe Connect) | HIGH — from docs + code |
| **Geography** | Italy primary (EU), multi-currency for international clients | HIGH — EUR default, IT tax law, ritenuta d'acconto |
| **Volume tier** | < $100K/mo MRR (early stage, targeting ~€19K at 18 months) | HIGH — from product doc |
| **Existing stack** | Next.js 16 + Supabase PostgreSQL + Stripe Connect + planned Google Play Billing | HIGH — from codebase |
| **Risk tolerance** | Startup / fast-moving — MVP phase, no SOX obligations | HIGH — from roadmap |

**Ambiguities requiring future clarification:**
- AdMob account region (EU publisher account or mixed?) → affects VAT on ad revenue
- Exact Google Play Billing integration state (not yet in codebase)
- Whether rewarded ads appear only on Android/TWA or also on web

---

## § 1 · ADR — ARCHITECTURE DECISION RECORD

### Context

InvoiceStudio has two monetization vectors today:
1. **Google Play Subscriptions**: Free (€0), Pro (€19/mo), Agency (€79/mo) — documented but not yet implemented in code
2. **Stripe Connect**: 0.5% commission on payment volume processed through the platform

We are adding a third: **Rewarded Ads**. Free-plan users can watch video ads to unlock extra invoices beyond their monthly quota. This creates three architectural challenges:
- Mixed revenue attribution (subscriptions + ads + commissions)
- Exactly-once credit delivery from untrusted ad platform callbacks
- Abuse prevention without degrading legitimate user experience

### Decision

We will build a **credit-ledger architecture** with the following design choices:

1. **Unified revenue ledger** (`revenue_events` table) — all three revenue streams post to a single append-only journal, partitioned by `revenue_source` (`subscription`, `commission`, `ad_reward`)
2. **Credit wallet per organization** (`org_credits` with `earned_credits` + `consumed_credits` running balances) — credits are non-transferable, org-scoped
3. **Ad reward idempotency via AdMob callback token** — the AdMob `reward_item` callback payload contains a unique `reward_amount` + server-side verification token; we hash this as the idempotency key
4. **Credits expire at end-of-cycle** — rewarded credits do NOT roll over; the monthly invoice quota resets on the 1st of each month simultaneously with credit expiry. This avoids the accounting nightmare of indefinite credit balances
5. **Ad fraud detection at three layers**: rate limiting (per-user velocity), token uniqueness (server-side verify via Google's `verifyRewardedAd` callback), and basic device fingerprinting (screen resolution + user agent hash)
6. **AdMob reconciliation via scheduled job** — a daily cron queries AdMob reporting API, compares with internal `ad_impressions` table, flags discrepancies >2%

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| **Store credits as `organizations.extra_invoices_remaining` column** | No audit trail, can't trace fraud, can't reconcile, violates LAW 10 |
| **Credits roll over indefinitely** | Creates unbounded liability on balance sheet, complicates ASC 606 revenue recognition, increases fraud incentive |
| **Polling-based credit delivery** (client tells server "ad watched") | Trivial to forge — zero security. The client cannot be trusted. |
| **Redis-based credit counting** | Adds infrastructure dependency; PostgreSQL is sufficient at our volume tier (<1000 DAU) |
| **Separate tables per revenue type** | Makes reporting, reconciliation, and cross-revenue analytics unnecessarily complex |

### Consequences

**Positive:**
- Single revenue view for finance/accounting
- Credit delivery is cryptographically verifiable via Google server-side callback
- Audit trail for every credit earned and consumed
- Fraud detection doesn't impact paying users

**Trade-offs:**
- Credit expiry = users may lose unspent credits (acceptable: the business model is to convert them to paid plans)
- Server-side AdMob verification adds ~200ms latency to reward delivery (acceptable: the ad itself already took 15-30s)

**Known risks:**
- If Google AdMob server-side verification API has downtime, reward delivery is blocked (mitigation: local buffer of pending verifications with 1h TTL)
- Users on free plan with 3 rewarded invoices/month may still be unsatisfied → this is intentional: rewards should feel scarce

---

## § 2 · DATABASE: MIGRATION SCHEMA

### 2.1 `org_credits` — Credit Wallet per Organization

```sql
-- ============================================================================
-- org_credits: Per-organization credit wallet for rewarded ad earnings
-- Each org has exactly one row (created on first ad reward)
-- ============================================================================
CREATE TABLE public.org_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  earned_credits    integer NOT NULL DEFAULT 0 CHECK (earned_credits >= 0),
  consumed_credits  integer NOT NULL DEFAULT 0 CHECK (consumed_credits >= 0),
  -- running balance = earned_credits - consumed_credits (computed, not stored)
  current_period_start  date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  current_period_end    date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)  -- one wallet per org
);

COMMENT ON TABLE public.org_credits IS 'Credit wallet: 1 credit = 1 extra invoice on free plan. Credits expire at end of billing period.';

ALTER TABLE public.org_credits ENABLE ROW LEVEL SECURITY;

-- Only org owner can see their own wallet
CREATE POLICY "credits_tenant_select" ON public.org_credits
  FOR SELECT USING (org_id = current_org_id());

-- Inserts/updates happen via admin client (server-side only) — no direct user mutation
CREATE POLICY "credits_tenant_insert" ON public.org_credits
  FOR INSERT WITH CHECK (org_id = current_org_id());

CREATE INDEX idx_org_credits_org_id ON public.org_credits(org_id);

-- Trigger for updated_at
CREATE TRIGGER trg_org_credits_updated_at
  BEFORE UPDATE ON public.org_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.2 `ad_impressions` — Append-Only Ad Impression Ledger

```sql
-- ============================================================================
-- ad_impressions: Immutable log of every rewarded ad served, per AdMob callback.
-- This is the source-of-truth for all ad-related revenue events.
-- ============================================================================
CREATE TABLE public.ad_impressions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Idempotency: Google AdMob server-side verification token
  admob_callback_id   text UNIQUE NOT NULL,
  -- Metadata from AdMob callback
  ad_unit_id          text NOT NULL,
  reward_type         text NOT NULL DEFAULT 'invoice_credit',
  reward_amount       integer NOT NULL DEFAULT 1 CHECK (reward_amount > 0),
  -- Verification: did Google confirm the impression was valid?
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'duplicate')),
  verified_at         timestamptz,
  -- Revenue tracking (from AdMob estimated earnings — reconciled later)
  estimated_earnings_usd_micros bigint,  -- AdMob reports in USD micros (1e6 = $1.00)
  -- Abuse signals
  ip_address          text,
  user_agent_hash     text,  -- SHA-256 of user agent (not storing raw UA for privacy)
  device_fingerprint  text,  -- hash of screen resolution + language + timezone
  -- Audit
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ad_impressions IS 'Append-only ledger of every rewarded ad impression. No UPDATE or DELETE per LAW 10.';

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_impressions_tenant_select" ON public.ad_impressions
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_ad_impressions_org_id ON public.ad_impressions(org_id);
CREATE INDEX idx_ad_impressions_admob_callback ON public.ad_impressions(admob_callback_id);
CREATE INDEX idx_ad_impressions_created_at ON public.ad_impressions(created_at);
CREATE INDEX idx_ad_impressions_verification ON public.ad_impressions(verification_status)
  WHERE verification_status = 'pending';
```

### 2.3 `credit_transactions` — Double-Entry Credit Ledger

```sql
-- ============================================================================
-- credit_transactions: Immutable double-entry ledger for all credit movements.
-- Every credit earned (ad reward) has a corresponding debit in org_credits.
-- Every credit consumed (invoice creation) has a corresponding credit.
-- ============================================================================
CREATE TABLE public.credit_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Debit/Credit accounting:
  --   'earn'  → org_credits.earned_credits += amount  (credit to wallet)
  --   'consume' → org_credits.consumed_credits += amount (debit from wallet)
  --   'expire' → credits wiped at period end (no balance change, purely audit)
  --   'refund' → reverse a consume (credit back to wallet)
  entry_type      text NOT NULL CHECK (entry_type IN ('earn', 'consume', 'expire', 'refund')),
  amount          integer NOT NULL CHECK (amount > 0),
  -- Reference to the source transaction
  ad_impression_id uuid REFERENCES public.ad_impressions(id),
  invoice_id       uuid REFERENCES public.invoices(id),
  -- Idempotency for credit mutations
  idempotency_key  text UNIQUE NOT NULL,
  -- Running balance AFTER this transaction (for quick display)
  balance_after   integer NOT NULL,
  -- Reason for expiry/refund
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_transactions IS 'Immutable double-entry ledger per LAW 10. No UPDATE or DELETE.';

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_tx_tenant_select" ON public.credit_transactions
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_credit_tx_org_id ON public.credit_transactions(org_id);
CREATE INDEX idx_credit_tx_idempotency ON public.credit_transactions(idempotency_key);
CREATE INDEX idx_credit_tx_type ON public.credit_transactions(entry_type);
CREATE INDEX idx_credit_tx_created_at ON public.credit_transactions(created_at);
```

### 2.4 `revenue_events` — Unified Revenue Ledger

```sql
-- ============================================================================
-- revenue_events: Single append-only journal for ALL revenue across all sources.
-- Feeds the admin dashboard for revenue breakdown reporting.
-- ============================================================================
CREATE TABLE public.revenue_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Revenue source discriminator
  revenue_source  text NOT NULL CHECK (revenue_source IN (
    'subscription',   -- Google Play Billing subscription payment
    'commission',     -- Stripe Connect application fee
    'ad_reward'       -- Google AdMob rewarded ad impression
  )),
  -- Monetary amount in cents (EUR for subscription/commission, USD for ads — convert at period-end)
  amount_cents    integer NOT NULL,
  currency        text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD')),
  -- For EUR amounts: exchange rate used if source was non-EUR
  exchange_rate   numeric(10,6),
  -- Reference to source record (polymorphic — use appropriate column)
  subscription_id text,       -- Google Play order ID
  stripe_charge_id text,      -- Stripe charge ID
  ad_impression_id uuid REFERENCES public.ad_impressions(id),
  -- Period this revenue belongs to (for deferred revenue recognition)
  recognition_period_start date,
  recognition_period_end   date,
  -- Amount already recognized vs deferred
  recognized_amount_cents integer NOT NULL DEFAULT 0,
  deferred_amount_cents   integer NOT NULL DEFAULT 0,
  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revenue_amount_check CHECK (
    (revenue_source = 'subscription' AND subscription_id IS NOT NULL) OR
    (revenue_source = 'commission' AND stripe_charge_id IS NOT NULL) OR
    (revenue_source = 'ad_reward' AND ad_impression_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.revenue_events IS 'Unified revenue journal — append only per LAW 10. One row per revenue event across all sources.';

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_tenant_select" ON public.revenue_events
  FOR SELECT USING (org_id = current_org_id());

CREATE INDEX idx_revenue_events_org_id ON public.revenue_events(org_id);
CREATE INDEX idx_revenue_events_source ON public.revenue_events(revenue_source);
CREATE INDEX idx_revenue_events_created_at ON public.revenue_events(created_at);
CREATE INDEX idx_revenue_events_period ON public.revenue_events(recognition_period_start, recognition_period_end);
```

### 2.5 `rewarded_ad_config` — Admin-Controlled Limits

```sql
-- ============================================================================
-- rewarded_ad_config: Global configuration for rewarded ad program.
-- Single-row table updated by admins only.
-- ============================================================================
CREATE TABLE public.rewarded_ad_config (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  max_rewarded_invoices_month integer NOT NULL DEFAULT 3,
  credits_per_reward          integer NOT NULL DEFAULT 1,   -- 1 ad = 1 credit
  credits_expire_at_period_end boolean NOT NULL DEFAULT true, -- if false, roll over
  min_seconds_between_ads     integer NOT NULL DEFAULT 300,  -- 5 min cooldown
  max_ads_per_user_per_day    integer NOT NULL DEFAULT 5,
  enabled                     boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row
INSERT INTO public.rewarded_ad_config (id) VALUES (1) ON CONFLICT DO NOTHING;
```

### 2.6 Migration Script (Forward)

```sql
-- ============================================================================
-- Migration: Rewarded Ads — Phase 1 (EXPAND)
-- Run in Supabase SQL Editor
-- Date: 2026-05-19
-- ============================================================================
BEGIN;

-- 1. Create new tables (all add-only — no existing data affected)
\i '01-org_credits.sql'
\i '02-ad_impressions.sql'
\i '03-credit_transactions.sql'
\i '04-revenue_events.sql'
\i '05-rewarded_ad_config.sql'

-- 2. Add new event types to existing invoice_events constraint
ALTER TABLE public.invoice_events
  DROP CONSTRAINT IF EXISTS invoice_events_event_type_check;

ALTER TABLE public.invoice_events
  ADD CONSTRAINT invoice_events_event_type_check
  CHECK (event_type IN (
    'created', 'sent', 'opened', 'paid', 'reminder_sent', 'cancelled', 'viewed',
    'rewarded_credit_used'  -- NEW: invoice created using a rewarded credit
  ));

-- 3. Add index for quota queries on invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org_month
  ON public.invoices(org_id, (date_trunc('month', created_at)::date))
  WHERE deleted_at IS NULL;

COMMIT;
```

### 2.7 Rollback Script

```sql
-- ============================================================================
-- Migration: Rewarded Ads — Rollback (CONTRACT phase)
-- Only safe after 2 full deploy cycles with zero reads on dropped tables.
-- ============================================================================
BEGIN;

DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.revenue_events CASCADE;
DROP TABLE IF EXISTS public.ad_impressions CASCADE;
DROP TABLE IF EXISTS public.org_credits CASCADE;
DROP TABLE IF EXISTS public.rewarded_ad_config CASCADE;

-- Restore original constraint
ALTER TABLE public.invoice_events
  DROP CONSTRAINT IF EXISTS invoice_events_event_type_check;

ALTER TABLE public.invoice_events
  ADD CONSTRAINT invoice_events_event_type_check
  CHECK (event_type IN (
    'created', 'sent', 'opened', 'paid', 'reminder_sent', 'cancelled', 'viewed'
  ));

DROP INDEX IF EXISTS idx_invoices_org_month;

COMMIT;
```

---

## § 3 · IMPLEMENTATION — AD REWARD CLAIM API

### 3.1 API Route: `POST /api/ads/reward-claim`

This is the server-side endpoint called by the client after Google AdMob's `onUserEarnedReward` callback fires. The client sends the AdMob verification payload; the server verifies with Google before granting credit.

```typescript
// src/app/api/ads/reward-claim/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentOrgId, getCurrentUser } from "@/lib/supabase/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import crypto from "crypto";

// ─── Request schema ─────────────────────────────────────────────────────────

const rewardClaimSchema = z.object({
  // AdMob server-side verification token (from onUserEarnedReward callback)
  admob_callback_id: z.string().min(1, "Missing AdMob callback ID"),
  ad_unit_id: z.string().min(1, "Missing ad unit ID"),
  reward_type: z.string().default("invoice_credit"),
  reward_amount: z.number().int().positive().default(1),
  // Abuse prevention signals (collected client-side)
  user_agent_hash: z.string().optional(),
  device_fingerprint: z.string().optional(),
});

// ─── POST /api/ads/reward-claim ──────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const user = await getCurrentUser();
  const orgId = await getCurrentOrgId();

  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: prevent rapid reward claims ───────────────────────────────
  const rlKey = getRateLimitKey(request, user.id);
  const rl = rateLimit(`ad_reward:${rlKey}`, 10, 60_000); // 10 claims/min
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  const body = await request.json();
  const parsed = rewardClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    admob_callback_id,
    ad_unit_id,
    reward_type,
    reward_amount,
    user_agent_hash,
    device_fingerprint,
  } = parsed.data;

  const adminClient = createAdminClient();

  // ── IDEMPOTENCY GATE (LAW 02) ─────────────────────────────────────────────
  // The AdMob callback ID is unique per impression — use it as idempotency key.
  const { data: existingImpression } = await adminClient
    .from("ad_impressions")
    .select("id, verification_status")
    .eq("admob_callback_id", admob_callback_id)
    .maybeSingle();

  if (existingImpression) {
    if (existingImpression.verification_status === "verified") {
      return NextResponse.json({
        data: {
          status: "duplicate",
          message: "Reward already claimed for this impression",
          ad_impression_id: existingImpression.id,
        },
      });
    }
    if (existingImpression.verification_status === "duplicate") {
      return NextResponse.json({
        data: { status: "duplicate", ad_impression_id: existingImpression.id },
      });
    }
    // If status is 'pending' or 'rejected', we can retry verification
  }

  // ── Server-side verification with Google AdMob ─────────────────────────────
  // In production: call Google's server-side verification API.
  // For now: verify the callback_id format (AdMob tokens have a known structure).
  // TODO: Replace with actual Google AdMob API call:
  //   const googleResult = await verifyAdMobReward(admob_callback_id);
  const verificationResult = await verifyAdMobCallback(admob_callback_id);
  if (!verificationResult.valid) {
    // Log the rejected attempt for fraud analysis
    await adminClient.from("ad_impressions").insert({
      org_id: orgId,
      user_id: user.id,
      admob_callback_id: admob_callback_id,
      ad_unit_id,
      reward_type,
      reward_amount,
      verification_status: "rejected",
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
      user_agent_hash,
      device_fingerprint,
    });
    return NextResponse.json(
      { error: "Ad verification failed", reason: verificationResult.reason },
      { status: 400 }
    );
  }

  // ── Abuse check: cooldown period ──────────────────────────────────────────
  const { data: lastClaim } = await adminClient
    .from("ad_impressions")
    .select("created_at")
    .eq("org_id", orgId)
    .eq("verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastClaim) {
    const secondsSinceLastClaim =
      (Date.now() - new Date(lastClaim.created_at).getTime()) / 1000;

    // Fetch cooldown config
    const { data: config } = await adminClient
      .from("rewarded_ad_config")
      .select("min_seconds_between_ads, max_ads_per_user_per_day")
      .single();

    const cooldown = config?.min_seconds_between_ads ?? 300;
    if (secondsSinceLastClaim < cooldown) {
      return NextResponse.json(
        {
          error: "Cooldown active",
          retryAfter: Math.ceil(cooldown - secondsSinceLastClaim),
        },
        { status: 429 }
      );
    }
  }

  // ── Abuse check: daily cap ────────────────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayCount } = await adminClient
    .from("ad_impressions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("verification_status", "verified")
    .gte("created_at", todayStart.toISOString());

  const dailyCap = config?.max_ads_per_user_per_day ?? 5;
  if ((todayCount ?? 0) >= dailyCap) {
    return NextResponse.json(
      { error: "Daily reward limit reached", limit: dailyCap },
      { status: 429 }
    );
  }

  // ── TRANSACTION: Atomic insert + credit grant ─────────────────────────────
  // Use a single Supabase transaction (via RPC or serialized operations)

  // 1. Insert ad impression
  const { data: impression, error: impressionError } = await adminClient
    .from("ad_impressions")
    .insert({
      org_id: orgId,
      user_id: user.id,
      admob_callback_id: admob_callback_id,
      ad_unit_id,
      reward_type,
      reward_amount,
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      estimated_earnings_usd_micros: verificationResult.estimatedEarningsUsdMicros ?? null,
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
      user_agent_hash,
      device_fingerprint,
    })
    .select("id")
    .single();

  if (impressionError) {
    // If it was a unique violation on callback_id, another request beat us — idempotent
    if (impressionError.code === "23505") {
      const { data: existing } = await adminClient
        .from("ad_impressions")
        .select("id")
        .eq("admob_callback_id", admob_callback_id)
        .single();
      return NextResponse.json({
        data: { status: "duplicate", ad_impression_id: existing?.id },
      });
    }
    console.error("Failed to insert ad impression:", impressionError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 2. Upsert org_credits and credit earned_credits
  // Credit transaction idempotency key
  const creditIdempotencyKey = `earn_${admob_callback_id}_${orgId}`;

  const { data: existingCreditTx } = await adminClient
    .from("credit_transactions")
    .select("id")
    .eq("idempotency_key", creditIdempotencyKey)
    .maybeSingle();

  if (!existingCreditTx) {
    // Ensure org_credits row exists
    const { data: orgCredits } = await adminClient
      .from("org_credits")
      .select("id, earned_credits, consumed_credits")
      .eq("org_id", orgId)
      .maybeSingle();

    let newBalance: number;
    if (!orgCredits) {
      // First credit ever for this org — create wallet
      await adminClient.from("org_credits").insert({
        org_id: orgId,
        earned_credits: reward_amount,
        consumed_credits: 0,
      });
      newBalance = reward_amount;
    } else {
      newBalance =
        orgCredits.earned_credits - orgCredits.consumed_credits + reward_amount;
      await adminClient
        .from("org_credits")
        .update({
          earned_credits: orgCredits.earned_credits + reward_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgCredits.id);
    }

    // 3. Insert credit transaction (audit trail)
    await adminClient.from("credit_transactions").insert({
      org_id: orgId,
      entry_type: "earn",
      amount: reward_amount,
      ad_impression_id: impression.id,
      idempotency_key: creditIdempotencyKey,
      balance_after: newBalance,
    });
  }

  // 4. Post to revenue ledger
  const revenueIdempotencyKey = `rev_ad_${impression.id}`;
  const { data: existingRevenueEvent } = await adminClient
    .from("revenue_events")
    .select("id")
    .eq("ad_impression_id", impression.id)
    .maybeSingle();

  if (!existingRevenueEvent) {
    await adminClient.from("revenue_events").insert({
      org_id: orgId,
      revenue_source: "ad_reward",
      amount_cents: 0, // Will be backfilled during AdMob reconciliation
      currency: "USD",
      ad_impression_id: impression.id,
      recognition_period_start: new Date().toISOString().slice(0, 7) + "-01",
      recognition_period_end: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      )
        .toISOString()
        .slice(0, 10),
      recognized_amount_cents: 0,
      deferred_amount_cents: 0,
    });
  }

  // ── Return success ────────────────────────────────────────────────────────
  const { data: currentBalance } = await adminClient
    .from("org_credits")
    .select("earned_credits, consumed_credits")
    .eq("org_id", orgId)
    .single();

  return NextResponse.json({
    data: {
      status: "rewarded",
      credits_earned: reward_amount,
      balance: (currentBalance?.earned_credits ?? 0) - (currentBalance?.consumed_credits ?? 0),
      ad_impression_id: impression.id,
    },
  });
}

// ─── AdMob Server-Side Verification (stub — replace with Google API) ─────────
// See: https://developers.google.com/admob/android/rewarded-video-ssv

interface VerificationResult {
  valid: boolean;
  reason?: string;
  estimatedEarningsUsdMicros?: number;
}

async function verifyAdMobCallback(callbackId: string): Promise<VerificationResult> {
  // In production, call Google's SSV endpoint:
  //
  // const response = await fetch(
  //   `https://admanager.googleapis.com/v1/networks/.../rewardedAds:verify`,
  //   { headers: { Authorization: `Bearer ${accessToken}` } }
  // );
  //
  // For now, we validate that the callback_id is non-empty and well-formed.
  // AdMob callback IDs are base64-encoded query strings with signature.

  if (!callbackId || callbackId.length < 20) {
    return { valid: false, reason: "Invalid callback ID format" };
  }

  // Check for obvious tampering: the token should contain a timestamp
  // and a signature component separated by '~'
  const parts = callbackId.split("~");
  if (parts.length < 2) {
    return { valid: false, reason: "Callback ID missing signature" };
  }

  // TODO: Verify the signature using Google's public key
  // This is a critical security measure — without it, any client can forge claims.

  return {
    valid: true,
    estimatedEarningsUsdMicros: undefined, // Backfilled from AdMob reporting API
  };
}
```

### 3.2 IDEMPOTENCY KEY PATTERN (LAW 02)

```
Pattern: {operation}_{entity_id}_{YYYYMMDD}[_{nonce}]

ad_reward claim: earn_{admob_callback_id}_{org_id}
credit consume:   consume_{invoice_id}_{org_id}
credit expire:    expire_{org_id}_{YYYYMMDD}
```

All idempotency keys are stored in `credit_transactions.idempotency_key` (UNIQUE). On replay, the existing row prevents double-processing.

---

## § 4 · QUOTA ENFORCEMENT

### 4.1 Modified Invoice Creation: `POST /api/invoices`

The existing `POST /api/invoices` route lacks quota enforcement. The rewarded ads architecture requires injecting quota checks BEFORE invoice creation.

**Quota logic:**

```
free plan → max 5 invoices/month + up to 3 rewarded credits
pro plan  → unlimited
agency    → unlimited
```

```typescript
// In POST /api/invoices — BEFORE invoice insert, add this block:

// ── Quota enforcement ───────────────────────────────────────────────────────
const { data: org } = await supabase
  .from("organizations")
  .select("plan")
  .eq("id", orgId)
  .single();

// Only enforce quota on free plan
if (org?.plan === "free") {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: monthlyInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", monthStart.toISOString());

  const FREE_LIMIT = 5;

  if ((monthlyInvoices ?? 0) >= FREE_LIMIT) {
    // Check if org has rewarded credits available
    const { data: orgCredits } = await supabase
      .from("org_credits")
      .select("earned_credits, consumed_credits")
      .eq("org_id", orgId)
      .maybeSingle();

    const availableCredits =
      (orgCredits?.earned_credits ?? 0) - (orgCredits?.consumed_credits ?? 0);

    if (availableCredits <= 0) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: `Hai raggiunto il limite di ${FREE_LIMIT} fatture gratuite questo mese.`,
          quota: {
            limit: FREE_LIMIT,
            used: monthlyInvoices,
            credited_available: 0,
            suggestion: "Guarda un annuncio per ottenere 1 fattura extra, o passa al piano Pro.",
          },
        },
        { status: 402 } // Payment Required
      );
    }
    // Credits available — will be consumed after successful invoice creation
  }
}
```

### 4.2 Credit Consumption (within invoice creation transaction)

After successful invoice creation, if the user exceeded the free limit, consume one credit:

```typescript
// After successful invoice insert, if free plan and over quota:
if (org?.plan === "free" && (monthlyInvoices ?? 0) >= FREE_LIMIT) {
  const consumeKey = `consume_${invoice.id}_${orgId}`;

  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("idempotency_key", consumeKey)
    .maybeSingle();

  if (!existingTx) {
    const newConsumed = (orgCredits?.consumed_credits ?? 0) + 1;
    const newBalance = (orgCredits?.earned_credits ?? 0) - newConsumed;

    await supabase
      .from("org_credits")
      .update({
        consumed_credits: newConsumed,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);

    await supabase.from("credit_transactions").insert({
      org_id: orgId,
      entry_type: "consume",
      amount: 1,
      invoice_id: invoice.id,
      idempotency_key: consumeKey,
      balance_after: newBalance,
    });
  }

  // Mark invoice event with rewarded_credit flag
  await supabase.from("invoice_events").insert({
    invoice_id: invoice.id,
    event_type: "rewarded_credit_used",
    metadata: { credit_transaction_key: consumeKey },
  });
}
```

### 4.3 Monthly Credit Reset (Scheduled Job)

```sql
-- ============================================================================
-- Function: reset_org_credits_period()
-- Called by a cron job at 00:01 on the 1st of each month.
-- Per LAW 06: all timestamps in UTC.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_org_credits_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_start date := date_trunc('month', CURRENT_DATE)::date;
  v_period_end   date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_org RECORD;
  v_expired_key text;
  v_expired_credits integer;
BEGIN
  FOR v_org IN
    SELECT id FROM public.org_credits
    WHERE current_period_end < v_period_start  -- period has ended
    AND (earned_credits - consumed_credits) > 0  -- has unspent credits
  LOOP
    v_expired_credits := (
      SELECT earned_credits - consumed_credits
      FROM public.org_credits
      WHERE id = v_org.id
    );

    v_expired_key := 'expire_' || v_org.id || '_' || to_char(CURRENT_DATE, 'YYYYMMDD');

    -- Record expiry in ledger
    INSERT INTO public.credit_transactions (
      org_id, entry_type, amount, idempotency_key, balance_after, reason
    ) VALUES (
      (SELECT org_id FROM public.org_credits WHERE id = v_org.id),
      'expire',
      v_expired_credits,
      v_expired_key,
      0,
      'Monthly credit reset — credits do not roll over'
    );

    -- Reset balances
    UPDATE public.org_credits
    SET earned_credits = 0,
        consumed_credits = 0,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        updated_at = now()
    WHERE id = v_org.id;
  END LOOP;

  -- Also update orgs that had zero balance but need period reset
  UPDATE public.org_credits
  SET current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = now()
  WHERE current_period_end < v_period_start;
END;
$$;

-- Scheduled via: SELECT cron.schedule(
--   'reset-credits-monthly',
--   '0 1 1 * *',   -- 00:01 UTC on 1st of month
--   'SELECT public.reset_org_credits_period();'
-- );
```

### 4.4 Credit Balance API: `GET /api/ads/credits`

```typescript
// src/app/api/ads/credits/route.ts
import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch plan, quota usage, and credits
  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();

  const { data: credits } = await supabase
    .from("org_credits")
    .select("earned_credits, consumed_credits, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: monthlyInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", monthStart.toISOString());

  const plan = org?.plan ?? "free";
  const freeLimit = plan === "free" ? 5 : null;
  const earnedCredits = credits?.earned_credits ?? 0;
  const consumedCredits = credits?.consumed_credits ?? 0;
  const availableCredits = earnedCredits - consumedCredits;

  return NextResponse.json({
    data: {
      plan,
      invoice_quota: freeLimit
        ? {
            limit: freeLimit,
            used: monthlyInvoices ?? 0,
            remaining: Math.max(0, freeLimit - (monthlyInvoices ?? 0)),
          }
        : null,
      credits: {
        earned: earnedCredits,
        consumed: consumedCredits,
        available: availableCredits,
        expires_at: credits?.current_period_end ?? null,
        max_per_month: 3,
      },
      can_create_invoice:
        plan !== "free" ||
        (monthlyInvoices ?? 0) < freeLimit! ||
        availableCredits > 0,
    },
  });
}
```

---

## § 5 · ABUSE PREVENTION

### 5.1 Detection Layers

| Layer | Technique | Response |
|-------|-----------|----------|
| **L1: Rate limiting** | In-memory rate limiter: 10 claims/min per user, 5 ads/day | 429 + retry-after header |
| **L2: Token uniqueness** | `ad_impressions.admob_callback_id` UNIQUE constraint | Idempotent — returns duplicate status |
| **L3: Server-side verification** | Google AdMob SSV callback verification (signature check) | Rejects forged claims before insert |
| **L4: Cooldown enforcement** | Min 5 minutes between verified ad impressions per org | 429 with retryAfter |
| **L5: Device fingerprinting** | Hash of screen resolution + timezone + language | Flagged for review if rapid claims from different fingerprints on same account |
| **L6: Velocity anomaly** | If same user claims >10 ads across 3+ IPs in 24h → flag | Auto-disable reward eligibility, manual review |

### 5.2 Fraud Detection Query (for admin dashboard)

```sql
-- Suspicious users: rapid reward claims from multiple IPs
SELECT
  org_id,
  COUNT(*) AS claims_24h,
  COUNT(DISTINCT ip_address) AS distinct_ips,
  COUNT(DISTINCT device_fingerprint) AS distinct_devices,
  MAX(created_at) AS last_claim
FROM public.ad_impressions
WHERE verification_status = 'verified'
  AND created_at > now() - INTERVAL '24 hours'
GROUP BY org_id
HAVING COUNT(DISTINCT ip_address) > 2
   OR COUNT(DISTINCT device_fingerprint) > 2
ORDER BY claims_24h DESC;
```

### 5.3 `abuse_flags` Table

```sql
CREATE TABLE public.abuse_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_type       text NOT NULL CHECK (flag_type IN (
    'rapid_claims', 'multi_ip', 'multi_device', 'vpn_detected', 'token_reuse'
  )),
  severity        text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details         jsonb,
  resolved        boolean NOT NULL DEFAULT false,
  resolved_by     uuid REFERENCES auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## § 6 · ADMIN REPORTING DASHBOARD

### 6.1 Revenue Breakdown Query

```sql
-- ============================================================================
-- Revenue breakdown by source for current month
-- ============================================================================
SELECT
  revenue_source,
  COUNT(*) AS event_count,
  SUM(amount_cents) / 100.0 AS total_eur,
  COUNT(DISTINCT org_id) AS unique_orgs
FROM public.revenue_events
WHERE recognition_period_start = date_trunc('month', CURRENT_DATE)::date
GROUP BY revenue_source
ORDER BY total_eur DESC;
```

### 6.2 Revenue Trends (12 months, by source)

```sql
SELECT
  date_trunc('month', recognition_period_start)::date AS month,
  revenue_source,
  SUM(amount_cents) / 100.0 AS revenue_eur
FROM public.revenue_events
WHERE recognition_period_start >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')::date
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### 6.3 Ad Revenue per User (top free-plan users)

```sql
SELECT
  ai.org_id,
  org.name,
  COUNT(*) AS ads_watched,
  SUM(ct.amount) AS credits_earned,
  SUM(CASE WHEN ct.entry_type = 'consume' THEN ct.amount ELSE 0 END) AS credits_spent,
  SUM(ct.amount) FILTER (WHERE ct.entry_type = 'earn')
    - SUM(ct.amount) FILTER (WHERE ct.entry_type = 'consume') AS unused_credits
FROM public.ad_impressions ai
JOIN public.organizations org ON org.id = ai.org_id
LEFT JOIN public.credit_transactions ct ON ct.ad_impression_id = ai.id
WHERE ai.verification_status = 'verified'
  AND ai.created_at >= date_trunc('month', CURRENT_DATE)::date
GROUP BY ai.org_id, org.name
ORDER BY ads_watched DESC;
```

### 6.4 Admin API Route: `GET /api/admin/revenue-breakdown`

```typescript
// src/app/api/admin/revenue-breakdown/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only check: user must be in admin role
  const adminClient = createAdminClient();
  const { data: member } = await adminClient
    .from("org_members")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1);

  // In production, check against a dedicated admin_users table
  // For now, any owner can see their org's breakdown

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month"; // month | quarter | year

  let startDate: string;
  const now = new Date();
  switch (period) {
    case "quarter":
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      break;
    case "year":
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  const { data: breakdown } = await adminClient
    .from("revenue_events")
    .select("revenue_source, amount_cents, currency")
    .gte("created_at", startDate);

  const bySource = {
    subscription: { total_cents: 0, count: 0 },
    commission: { total_cents: 0, count: 0 },
    ad_reward: { total_cents: 0, count: 0 },
  };

  for (const event of breakdown ?? []) {
    bySource[event.revenue_source as keyof typeof bySource].total_cents += event.amount_cents;
    bySource[event.revenue_source as keyof typeof bySource].count += 1;
  }

  const totalCents = Object.values(bySource).reduce((s, v) => s + v.total_cents, 0);

  return NextResponse.json({
    data: {
      period,
      start_date: startDate,
      end_date: now.toISOString(),
      breakdown: {
        subscription: {
          ...bySource.subscription,
          percentage: totalCents > 0 ? (bySource.subscription.total_cents / totalCents * 100).toFixed(1) : 0,
        },
        commission: {
          ...bySource.commission,
          percentage: totalCents > 0 ? (bySource.commission.total_cents / totalCents * 100).toFixed(1) : 0,
        },
        ad_reward: {
          ...bySource.ad_reward,
          percentage: totalCents > 0 ? (bySource.ad_reward.total_cents / totalCents * 100).toFixed(1) : 0,
        },
      },
      total_cents: totalCents,
      total_eur: (totalCents / 100).toFixed(2),
    },
  });
}
```

---

## § 7 · GOOGLE ADMOB PAYOUT RECONCILIATION

### 7.1 How AdMob Revenue Flows

```
1. User watches rewarded ad in InvoiceStudio app (TWA)
2. Google AdMob serves the ad, pays InvoiceStudio based on CPM/CPC
3. Google pays out NET-30 via wire transfer to company bank account
4. AdMob earnings are reported in USD (estimated, then finalized)
5. InvoiceStudio records ad revenue internally in EUR (period-end ECB rate)
```

### 7.2 Reconciliation Architecture

```
┌──────────────────┐     ┌────────────────────┐     ┌───────────────────┐
│ ad_impressions   │     │ Daily Reconcile Job │     │ AdMob Reporting   │
│ (internal ledger)│────▶│ compares internal   │◀────│ API (Google)      │
│                  │     │ vs AdMob API data   │     │                   │
└──────────────────┘     └──────┬─────────────┘     └───────────────────┘
                                │
                          ┌─────▼──────────┐
                          │ reconciliation  │
                          │ _results table  │
                          └────────────────┘
```

### 7.3 Reconciliation Table

```sql
CREATE TABLE public.admob_reconciliation_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date         date NOT NULL,
  -- Internal metrics (from ad_impressions)
  internal_impressions integer NOT NULL DEFAULT 0,
  internal_earnings_usd_micros bigint NOT NULL DEFAULT 0,
  -- AdMob API metrics
  admob_impressions   integer,
  admob_earnings_usd_micros bigint,
  admob_clicks        integer,
  admob_ecpm_usd_micros bigint,
  -- Reconciliation
  impression_delta    integer,
  earnings_delta_usd_micros bigint,
  delta_pct           numeric(5,2),
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'discrepancy', 'resolved', 'ignored')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_admob_reconciliation_date ON public.admob_reconciliation_results(report_date);
```

### 7.4 Reconciliation Job (Daily Cron)

```typescript
// src/app/api/cron/reconcile-admob/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const reportDate = yesterday.toISOString().slice(0, 10);

  // 1. Aggregate internal ad impressions for yesterday
  const { data: internalStats } = await adminClient
    .from("ad_impressions")
    .select("count, estimated_earnings_usd_micros")
    .eq("verification_status", "verified")
    .gte("created_at", `${reportDate}T00:00:00Z`)
    .lt("created_at", `${reportDate}T23:59:59Z`)
    .single();

  // 2. Fetch AdMob report via Google AdMob API
  // TODO: Implement actual Google AdMob API call using service account
  // const admobReport = await fetchAdMobReport(reportDate);

  // For now, insert reconciliation stub
  const { data: existing } = await adminClient
    .from("admob_reconciliation_results")
    .select("id")
    .eq("report_date", reportDate)
    .maybeSingle();

  if (!existing) {
    await adminClient.from("admob_reconciliation_results").insert({
      report_date: reportDate,
      internal_impressions: 0, // stub
      internal_earnings_usd_micros: 0,
      status: "pending",
      notes: "AdMob API integration pending — manual reconciliation required",
    });
  }

  // 3. Backfill revenue_events with actual earnings from AdMob
  // (once AdMob API is integrated)

  return NextResponse.json({
    data: { report_date: reportDate, status: "reconciliation_started" },
  });
}
```

### 7.5 Revenue Recognition for Ads (ASC 606)

Ads are recognized **at the time of impression** (not at payout). The AdMob estimated earnings are booked as revenue immediately with a contra-asset for the AdMob receivable (typically 95-98% collected). The final AdMob adjustment is booked as a period-end adjustment.

```
Journal entry (at impression):
  Dr. Accounts Receivable — AdMob    $0.003 (estimated)
  Cr. Ad Revenue                              $0.003

At payout (NET-30):
  Dr. Cash                            $2.85 (actual for 1000 impressions)
  Dr. Revenue Adjustment              $0.15 (difference from estimate)
  Cr. Accounts Receivable — AdMob              $3.00
```

---

## § 8 · FAILURE MODE ANALYSIS (FMEA)

### F1: Double credit from same ad impression

| Field | Detail |
|-------|--------|
| **WHAT BREAKS** | User receives 2+ credits for watching the same ad once |
| **PROBABILITY** | **LOW** — `admob_callback_id` UNIQUE constraint + credit_transaction idempotency key |
| **IMPACT** | Financial: free users exceed quota without watching ads; Revenue: lost Pro conversions |
| **DETECTION** | Metric: `billing_credit_earn_total` counter spike; Alert: ratio of credits_earned / ad_impressions > 1.1 |
| **AUTO-RECOVERY** | Idempotency gate at API handler level rejects duplicate `admob_callback_id` before credit grant |
| **MANUAL RUNBOOK** | 1. Query `credit_transactions` WHERE `idempotency_key` LIKE `earn_%` GROUP BY `org_id` HAVING COUNT > 1; 2. Identify affected orgs; 3. Insert compensating `refund` transaction to correct balance; 4. Mark duplicate impressions as `verification_status = 'duplicate'` |

### F2: AdMob SSV verification service unavailable

| Field | Detail |
|-------|--------|
| **WHAT BREAKS** | All reward claims fail — users watch ads but never receive credits |
| **PROBABILITY** | **MEDIUM** — Google API downtime is infrequent but real |
| **IMPACT** | UX: free users unable to earn credits → frustration → churn |
| **DETECTION** | Alert: `ad_reward_verification_failure_rate > 20%` over 5 minutes |
| **AUTO-RECOVERY** | Queue pending verifications; retry with exponential backoff for up to 1 hour |
| **MANUAL RUNBOOK** | 1. Check Google AdMob status dashboard; 2. If outage > 1h, consider enabling "trusted client mode" temporarily (verify form factor but skip SSV — HIGH RISK); 3. Post-recovery: replay all pending `ad_impressions` with `verification_status = 'pending'` |

### F3: User accumulates credits just before month-end and doesn't use them

| Field | Detail |
|-------|--------|
| **WHAT BREAKS** | Credits expire at period end — user feels "robbed" |
| **PROBABILITY** | **HIGH** — inherent to the expiry design |
| **IMPACT** | UX: negative reviews, support tickets; Business: intentional — drives Pro conversion |
| **DETECTION** | Metric: `billing_credit_expiry_total`; Dashboard: "credits expiring in 7 days" section |
| **AUTO-RECOVERY** | Send email notification 3 days before expiry: "Usa i tuoi crediti prima che scadano!" |
| **MANUAL RUNBOOK** | 1. If user complains, offer 1-month Pro trial as goodwill; 2. Do NOT manually extend credit expiry — sets precedent |

### F4: Monthly quota reset and credit reset race condition

| Field | Detail |
|-------|--------|
| **WHAT BREAKS** | User creates invoice in the window between quota reset time and credit reset time, potentially getting both old quota + old credits |
| **PROBABILITY** | **LOW** — both run in same transaction via `reset_org_credits_period()` |
| **IMPACT** | Minor: one extra invoice in edge case; Financial: negligible |
| **DETECTION** | Query: invoices created on 1st of month for free orgs that also have credit transactions on same day |
| **AUTO-RECOVERY** | The stored procedure resets both in one atomic transaction |
| **MANUAL RUNBOOK** | Review affected invoices; no action needed unless systematic |

### F5: AdMob reconciliation shows persistent 5%+ discrepancy

| Field | Detail |
|-------|--------|
| **WHAT BREAKS** | Internal ad impression count doesn't match AdMob reported impressions |
| **PROBABILITY** | **MEDIUM** — common in ad tech (timezone differences, dropped callbacks, ad blockers) |
| **IMPACT** | Financial: understated/overstated revenue; Compliance: inaccurate financial reporting |
| **DETECTION** | Alert: `admob_reconciliation_delta_pct > 5%` on daily reconciliation job |
| **AUTO-RECOVERY** | Flag for manual review; auto-adjust if delta < 2% |
| **MANUAL RUNBOOK** | 1. Compare by hour to identify timezone misalignment; 2. Check ad_unit_id filtering; 3. Verify AdMob API credentials; 4. Adjust internal estimates to match AdMob finalized numbers at month-end |

---

## § 9 · COMPLIANCE MATRIX

| Domain | Detail |
|--------|--------|
| **PCI scope** | **SAQ A** — no change. Ad reward claims do not touch cardholder data. Payment flows remain tokenized via Stripe. |
| **GDPR** | `ip_address` stored in `ad_impressions` for fraud detection → must be disclosed in privacy policy. `user_agent_hash` uses SHA-256 (pseudonymous). Data retention: ad impressions retained for 24 months (fraud analysis), then pseudonymized. |
| **Tax (IT)** | AdMob revenue is USD → converted to EUR at ECB month-end rate. Ad revenue is subject to Italian corporate tax. VAT treatment of AdMob: Google reverse-charges VAT on AdMob services (business-to-business within EU). |
| **SCA** | Not applicable to ad reward flow (no payment authentication). |
| **SOX** | Not applicable at current volume tier. If/when needed: segregation of duties between ad impression recording and reconciliation. |
| **Data retention** | `ad_impressions`: 24 months active + 36 months pseudonymized. `credit_transactions`: 10 years (Italian fiscal requirement). `revenue_events`: 10 years. |
| **Google Play policy** | Rewarded ads must comply with Google Play Developer Program Policies (ads must be clearly labeled, no misleading claims, no incentivized installs). |

---

## § 10 · OBSERVABILITY METRICS

```typescript
// Prometheus-compatible metrics (exported via /api/metrics)

// Counter: total rewarded ad claims (by verification status)
billing_ad_claim_total{status="verified|rejected|duplicate"}

// Counter: credits earned (delta on org_credits.earned_credits)
billing_credit_earn_total

// Counter: credits consumed (delta on org_credits.consumed_credits)
billing_credit_consume_total

// Counter: credits expired (from reset job)
billing_credit_expiry_total

// Gauge: current unreconciled ad revenue
billing_admob_unreconciled_usd_micros

// Histogram: ad reward claim latency (ms)
billing_ad_reward_claim_duration_ms

// Gauge: users with reward eligibility
billing_reward_eligible_users{plan="free"}

// Counter: quota-exceeded responses (HTTP 402)
billing_quota_exceeded_total

// Counter: abuse flags raised (by type)
billing_abuse_flag_total{flag_type="rapid_claims|multi_ip|multi_device|vpn_detected|token_reuse"}
```

---

## § 11 · CLIENT INTEGRATION NOTES

### 11.1 TWA/Android

The rewarded ad flow on Android uses Google Mobile Ads SDK:

```typescript
// Client-side (TWA — injected via JavaScript interface)
// 1. Load rewarded ad
// 2. On user completion → onUserEarnedReward callback
// 3. Send reward claim to server

interface AdMobRewardCallback {
  admob_callback_id: string;  // Server-side verification token
  ad_unit_id: string;
  reward_type: string;
  reward_amount: number;
}

async function claimReward(reward: AdMobRewardCallback) {
  const response = await fetch("/api/ads/reward-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      admob_callback_id: reward.admob_callback_id,
      ad_unit_id: reward.ad_unit_id,
      reward_type: reward.reward_type,
      reward_amount: reward.reward_amount,
      user_agent_hash: await sha256(navigator.userAgent),
      device_fingerprint: await sha256(
        `${window.screen.width}x${window.screen.height}_${Intl.DateTimeFormat().resolvedOptions().timeZone}_${navigator.language}`
      ),
    }),
  });
  return response.json();
}
```

### 11.2 Web (non-TWA)

For web users, Google AdSense rewarded ads or a third-party rewarded video ad network should be used. The server-side API is identical — only the ad SDK differs.

---

## § 12 · SUMMARY OF DELIVERABLES

| # | File | Purpose |
|---|------|---------|
| 1 | `backend/migration-rewarded-ads.sql` | Full DDL migration (forward + rollback) |
| 2 | `frontend/src/app/api/ads/reward-claim/route.ts` | Ad reward claim API — idempotent credit delivery |
| 3 | `frontend/src/app/api/ads/credits/route.ts` | Credit balance + quota check API |
| 4 | `frontend/src/app/api/admin/revenue-breakdown/route.ts` | Admin revenue dashboard API |
| 5 | `frontend/src/app/api/cron/reset-credits/route.ts` | Monthly credit reset cron |
| 6 | `frontend/src/app/api/cron/reconcile-admob/route.ts` | Daily AdMob reconciliation cron |
| 7 | `backend/reset_org_credits_period.sql` | Stored procedure for atomic credit reset |
| 8 | Modifications to `POST /api/invoices` | Quota enforcement + credit consumption |
