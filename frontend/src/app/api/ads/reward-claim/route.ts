import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// ─── Request validation ──────────────────────────────────────────────────────

const rewardClaimSchema = z.object({
  admob_callback_id: z.string().min(1, "Missing AdMob callback ID"),
  ad_unit_id: z.string().min(1, "Missing ad unit ID"),
  reward_type: z.string().default("invoice_credit"),
  reward_amount: z.number().int().positive().default(1),
  user_agent_hash: z.string().optional(),
  device_fingerprint: z.string().optional(),
});

// ─── POST /api/ads/reward-claim ──────────────────────────────────────────────
//
// Idempotency: admob_callback_id is the natural idempotency key (unique per
// Google impression). credit_transactions.idempotency_key = earn_{callback_id}_{org_id}
//
// Flow:
//   1. Auth check (must be logged in, must belong to an org)
//   2. Rate limit (10 claims/min per user)
//   3. Idempotency gate — check if callback_id already processed
//   4. Server-side AdMob verification (signature check)
//   5. Abuse checks: cooldown (5 min between claims), daily cap (5 ads/day)
//   6. Atomic insert: ad_impressions → org_credits → credit_transactions → revenue_events
//   7. Return balance

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgId = await getCurrentOrgId();

  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit (L1 abuse prevention) ──────────────────────────────────────
  const rlKey = getRateLimitKey(request, user.id);
  const rl = rateLimit(`ad_reward:${rlKey}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      },
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

  // ── Fetch global config ───────────────────────────────────────────────────
  const { data: rewardConfig } = await adminClient
    .from("rewarded_ad_config")
    .select("enabled, max_ads_per_user_per_day, min_seconds_between_ads, credits_per_reward")
    .single();

  if (!rewardConfig?.enabled) {
    return NextResponse.json(
      { error: "Rewarded ads are currently disabled" },
      { status: 503 }
    );
  }

  // ── IDEMPOTENCY GATE (LAW 02) ─────────────────────────────────────────────
  // The AdMob callback ID is unique per impression.
  // If we've already seen this callback_id, return existing result.
  const { data: existingImpression } = await adminClient
    .from("ad_impressions")
    .select("id, verification_status")
    .eq("admob_callback_id", admob_callback_id)
    .maybeSingle();

  if (existingImpression) {
    if (existingImpression.verification_status === "verified") {
      // Already granted — return current balance
      const { data: credits } = await adminClient
        .from("org_credits")
        .select("earned_credits, consumed_credits")
        .eq("org_id", orgId)
        .maybeSingle();

      return NextResponse.json({
        data: {
          status: "duplicate",
          message: "Reward already claimed for this impression",
          ad_impression_id: existingImpression.id,
          credits_earned: 0,
          balance: (credits?.earned_credits ?? 0) - (credits?.consumed_credits ?? 0),
        },
      });
    }

    if (existingImpression.verification_status === "duplicate") {
      return NextResponse.json({
        data: { status: "duplicate", ad_impression_id: existingImpression.id },
      });
    }

    // 'pending' or 'rejected' — allow retry verification
  }

  // ── Server-side AdMob verification (L2 abuse prevention) ──────────────────
  const verification = await verifyAdMobCallback(admob_callback_id);
  if (!verification.valid) {
    // Log rejected attempt for fraud analysis
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
      {
        error: "Ad verification failed",
        reason: verification.reason,
      },
      { status: 400 }
    );
  }

  // ── Cooldown check (L3 abuse prevention) ──────────────────────────────────
  const cooldownSecs = rewardConfig.min_seconds_between_ads ?? 300;

  const { data: lastClaim } = await adminClient
    .from("ad_impressions")
    .select("created_at")
    .eq("org_id", orgId)
    .eq("verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastClaim) {
    const elapsed =
      (Date.now() - new Date(lastClaim.created_at).getTime()) / 1000;
    if (elapsed < cooldownSecs) {
      return NextResponse.json(
        {
          error: "Cooldown active",
          retryAfter: Math.ceil(cooldownSecs - elapsed),
        },
        { status: 429 }
      );
    }
  }

  // ── Daily cap check (L4 abuse prevention) ─────────────────────────────────
  const dailyMax = rewardConfig.max_ads_per_user_per_day ?? 5;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayCount } = await adminClient
    .from("ad_impressions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("verification_status", "verified")
    .gte("created_at", todayStart.toISOString());

  if ((todayCount ?? 0) >= dailyMax) {
    return NextResponse.json(
      { error: "Daily reward limit reached", limit: dailyMax },
      { status: 429 }
    );
  }

  // ── TRANSACTION: Atomic insert + credit grant ─────────────────────────────
  // Step 1: Insert ad_impressions (admob_callback_id UNIQUE prevents race)

  const creditsToAward = rewardConfig.credits_per_reward ?? 1;

  const { data: impression, error: impressionError } = await adminClient
    .from("ad_impressions")
    .insert({
      org_id: orgId,
      user_id: user.id,
      admob_callback_id,
      ad_unit_id,
      reward_type,
      reward_amount: creditsToAward,
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      estimated_earnings_usd_micros:
        verification.estimatedEarningsUsdMicros ?? null,
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
      user_agent_hash,
      device_fingerprint,
    })
    .select("id")
    .single();

  if (impressionError) {
    // UNIQUE violation on admob_callback_id → race condition, another request won
    if (impressionError.code === "23505") {
      const { data: existing } = await adminClient
        .from("ad_impressions")
        .select("id, verification_status")
        .eq("admob_callback_id", admob_callback_id)
        .single();

      return NextResponse.json({
        data: {
          status:
            existing?.verification_status === "verified" ? "duplicate" : "pending",
          ad_impression_id: existing?.id,
        },
      });
    }

    console.error("Failed to insert ad impression:", impressionError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // Step 2: Upsert org_credits + increment earned_credits
  const creditIdempotencyKey = `earn_${admob_callback_id}_${orgId}`;

  const { data: existingCreditTx } = await adminClient
    .from("credit_transactions")
    .select("id")
    .eq("idempotency_key", creditIdempotencyKey)
    .maybeSingle();

  let finalBalance = 0;

  if (!existingCreditTx) {
    const { data: orgCredits } = await adminClient
      .from("org_credits")
      .select("id, earned_credits, consumed_credits")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!orgCredits) {
      // First credit ever → create wallet
      await adminClient.from("org_credits").insert({
        org_id: orgId,
        earned_credits: creditsToAward,
        consumed_credits: 0,
      });
      finalBalance = creditsToAward;
    } else {
      finalBalance =
        orgCredits.earned_credits -
        orgCredits.consumed_credits +
        creditsToAward;

      await adminClient
        .from("org_credits")
        .update({
          earned_credits: orgCredits.earned_credits + creditsToAward,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orgCredits.id);
    }

    // Step 3: Insert credit_transaction (audit trail)
    await adminClient.from("credit_transactions").insert({
      org_id: orgId,
      entry_type: "earn",
      amount: creditsToAward,
      ad_impression_id: impression.id,
      idempotency_key: creditIdempotencyKey,
      balance_after: finalBalance,
    });
  }

  // Step 4: Post to revenue_events (unified ledger)
  const { data: existingRevenue } = await adminClient
    .from("revenue_events")
    .select("id")
    .eq("ad_impression_id", impression.id)
    .maybeSingle();

  if (!existingRevenue) {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    await adminClient.from("revenue_events").insert({
      org_id: orgId,
      revenue_source: "ad_reward",
      amount_cents: 0, // Backfilled during AdMob reconciliation
      currency: "USD",
      ad_impression_id: impression.id,
      recognition_period_start: periodStart,
      recognition_period_end: lastDay,
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

  const balance =
    (currentBalance?.earned_credits ?? 0) -
    (currentBalance?.consumed_credits ?? 0);

  return NextResponse.json({
    data: {
      status: "rewarded",
      credits_earned: creditsToAward,
      balance,
      ad_impression_id: impression.id,
      daily_remaining: Math.max(0, dailyMax - (todayCount ?? 0) - 1),
    },
  });
}

// ─── AdMob Server-Side Verification ──────────────────────────────────────────
//
// In production, this calls Google's Rewarded Ads SSV endpoint:
//   POST https://admanager.googleapis.com/v1/networks/{networkCode}/rewardedAds:verify
//
// The callback_id is a base64-encoded query string containing:
//   - ad_network, ad_unit, reward_amount, custom_data, timestamp, signature
//
// The signature must be verified against Google's public key to prevent forgery.
//
// Reference: https://developers.google.com/admob/android/rewarded-video-ssv

interface VerificationResult {
  valid: boolean;
  reason?: string;
  estimatedEarningsUsdMicros?: number;
}

async function verifyAdMobCallback(
  callbackId: string
): Promise<VerificationResult> {
  // ── Format validation ────────────────────────────────────────────────────
  if (!callbackId || callbackId.length < 20) {
    return { valid: false, reason: "Invalid callback ID format" };
  }

  // AdMob callback IDs contain a signature component separated by '~'
  const parts = callbackId.split("~");
  if (parts.length < 2) {
    return { valid: false, reason: "Callback ID missing signature component" };
  }

  // ── TODO: Replace with actual Google AdMob API call ──────────────────────
  //
  // Production implementation:
  //
  // const accessToken = await getGoogleAccessToken(); // Service account JWT
  // const response = await fetch(
  //   `https://admanager.googleapis.com/v1/networks/${networkCode}/rewardedAds:verify`,
  //   {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${accessToken}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({ callbackId }),
  //   }
  // );
  //
  // const result = await response.json();
  // return {
  //   valid: result.isValid,
  //   estimatedEarningsUsdMicros: result.estimatedEarningsUsdMicros,
  // };

  // Stub: accept well-formed callback IDs during development
  // ⚠️ REMOVE BEFORE PRODUCTION — this allows any client to forge claims
  return {
    valid: true,
    estimatedEarningsUsdMicros: undefined,
  };
}
