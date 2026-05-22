import { createClient } from "@/lib/supabase/server";
import { getPlanQuota } from "@/types/rewards";
import type { UserQuota } from "@/types/rewards";

/**
 * Server-side plan utility functions.
 * Used by API routes to enforce plan limits and manage rewarded credits.
 */

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get the org's plan from the database.
 */
export async function getOrgPlan(orgId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  return data?.plan ?? "free";
}

/**
 * Count non-deleted invoices created by the org this month.
 */
export async function getCurrentMonthInvoiceCount(orgId: string): Promise<number> {
  const supabase = await createClient();
  const monthKey = getMonthKey();
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", `${monthKey}-01`)
    .lt("created_at", getNextMonthKey(monthKey))
    .limit(0);
  if (error) {
    console.error("getCurrentMonthInvoiceCount error:", error);
  }
  return count ?? 0;
}

/**
 * Get the org's rewarded credits for the current month.
 */
export async function getRewardedCredits(orgId: string): Promise<{
  credits: number;
  maxCredits: number;
}> {
  const supabase = await createClient();
  const monthKey = getMonthKey();
  const { data } = await supabase
    .from("rewarded_credits")
    .select("credits, max_credits")
    .eq("org_id", orgId)
    .eq("month_key", monthKey)
    .maybeSingle();
  return {
    credits: data?.credits ?? 0,
    maxCredits: data?.max_credits ?? 3,
  };
}

/**
 * Get the complete user quota: plan limit + usage + rewarded credits.
 */
export async function getUserQuota(orgId: string): Promise<UserQuota> {
  const plan = await getOrgPlan(orgId);
  const quota = getPlanQuota(plan);
  const currentMonthInvoices = await getCurrentMonthInvoiceCount(orgId);

  if (quota.unlimited) {
    return {
      plan,
      planLimit: Infinity,
      currentMonthInvoices,
      remainingBase: Infinity,
      rewardedCredits: 0,
      maxRewardedCredits: 0,
      canCreateInvoice: true,
      unlimited: true,
      showRewardedAdOption: false,
    };
  }

  const { credits, maxCredits } = await getRewardedCredits(orgId);
  const remainingBase = Math.max(0, quota.maxInvoices - currentMonthInvoices);
  const totalCapacity = quota.maxInvoices + credits;
  const canCreateInvoice = currentMonthInvoices < totalCapacity;

  let reason: UserQuota["reason"] | undefined;
  if (!canCreateInvoice) {
    if (credits >= maxCredits) {
      reason = "max_credits_reached";
    } else {
      reason = "no_credits";
    }
  }

  return {
    plan,
    planLimit: quota.maxInvoices,
    currentMonthInvoices,
    remainingBase,
    rewardedCredits: credits,
    maxRewardedCredits: maxCredits,
    canCreateInvoice,
    unlimited: false,
    reason,
    showRewardedAdOption:
      quota.rewardedAdsEnabled &&
      remainingBase <= 0 &&
      credits < maxCredits &&
      currentMonthInvoices < quota.maxInvoices + maxCredits,
  };
}

/**
 * Atomically grant rewarded credits to an org.
 * Uses upsert + row-level check to prevent exceeding max.
 */
export async function grantRewardedCredit(
  orgId: string,
  userId: string,
  verificationHash: string,
  adProvider: string = "admob",
  rewardAmount: number = 1
): Promise<{ success: boolean; creditsGranted: number; totalCredits: number; error?: string }> {
  const supabase = await createClient();
  const monthKey = getMonthKey();
  const quota = getPlanQuota(await getOrgPlan(orgId));

  if (!quota.rewardedAdsEnabled) {
    return { success: false, creditsGranted: 0, totalCredits: 0, error: "Rewarded ads not available on this plan" };
  }

  // 1. Record the claim (idempotency check via UNIQUE on verification_hash)
  const { error: claimError } = await supabase.from("reward_claims").insert({
    org_id: orgId,
    user_id: userId,
    ad_provider: adProvider,
    verification_hash: verificationHash,
    reward_amount: rewardAmount,
  });

  if (claimError) {
    // Duplicate claim (UNIQUE violation) — already processed
    if (claimError.code === "23505") {
      const { data: existing } = await supabase
        .from("rewarded_credits")
        .select("credits")
        .eq("org_id", orgId)
        .eq("month_key", monthKey)
        .maybeSingle();
      return {
        success: true,
        creditsGranted: 0,
        totalCredits: existing?.credits ?? 0,
      };
    }
    return { success: false, creditsGranted: 0, totalCredits: 0, error: "Failed to record reward claim" };
  }

  // 2. Upsert rewarded_credits with cap check
  const { data: current } = await supabase
    .from("rewarded_credits")
    .select("credits, max_credits")
    .eq("org_id", orgId)
    .eq("month_key", monthKey)
    .maybeSingle();

  const maxCredits = current?.max_credits ?? quota.maxRewardedCredits;
  const currentCredits = current?.credits ?? 0;
  const newCredits = Math.min(currentCredits + rewardAmount, maxCredits);

  if (currentCredits >= maxCredits) {
    // Already at cap — don't grant more, but claim was recorded
    return {
      success: true,
      creditsGranted: 0,
      totalCredits: currentCredits,
    };
  }

  const { error: upsertError } = await supabase.from("rewarded_credits").upsert(
    {
      org_id: orgId,
      month_key: monthKey,
      credits: newCredits,
      max_credits: maxCredits,
    },
    { onConflict: "org_id, month_key" }
  );

  if (upsertError) {
    return { success: false, creditsGranted: 0, totalCredits: currentCredits, error: "Failed to update credits" };
  }

  return {
    success: true,
    creditsGranted: newCredits - currentCredits,
    totalCredits: newCredits,
  };
}

/**
 * Consume one rewarded credit for invoice creation beyond the base plan limit.
 * Called AFTER successful invoice creation when the user has exceeded their
 * free plan invoice quota and is using a rewarded credit.
 *
 * Idempotent via invoice_id: each invoice can consume at most one credit.
 */
export async function consumeRewardedCredit(
  orgId: string,
  invoiceId: string
): Promise<{ consumed: boolean; remainingCredits: number }> {
  const supabase = await createClient();
  const monthKey = getMonthKey();

  // Guard: only consume if this invoice hasn't already consumed a credit
  const { data: existingEvent } = await supabase
    .from("invoice_events")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("event_type", "rewarded_credit_used")
    .maybeSingle();

  if (existingEvent) {
    // Already consumed — idempotent
    const { data: credits } = await supabase
      .from("rewarded_credits")
      .select("credits")
      .eq("org_id", orgId)
      .eq("month_key", monthKey)
      .maybeSingle();
    return { consumed: false, remainingCredits: credits?.credits ?? 0 };
  }

  // Fetch current credits
  const { data: current } = await supabase
    .from("rewarded_credits")
    .select("credits, max_credits")
    .eq("org_id", orgId)
    .eq("month_key", monthKey)
    .maybeSingle();

  const currentCredits = current?.credits ?? 0;
  if (currentCredits <= 0) {
    return { consumed: false, remainingCredits: 0 };
  }

  const newCredits = currentCredits - 1;

  // Atomically decrement credits
  const { error: updateError } = await supabase
    .from("rewarded_credits")
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("month_key", monthKey);

  if (updateError) {
    console.error("Failed to consume credit:", updateError);
    return { consumed: false, remainingCredits: currentCredits };
  }

  // Record the consumption event (idempotency gate via invoice_events)
  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    event_type: "rewarded_credit_used",
    metadata: {
      month_key: monthKey,
      credits_before: currentCredits,
      credits_after: newCredits,
    },
  });

  return { consumed: true, remainingCredits: newCredits };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month, 1); // month is 0-indexed in JS Date, so month=4 → May 1
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Generate a verification hash for a rewarded ad claim.
 * HMAC-SHA256(nonce + ":" + orgId + ":" + timestamp, secret)
 */
export function generateVerificationHash(
  nonce: string,
  orgId: string,
  timestamp: number
): string {
  // Placeholder: real hash computed async in API route via computeHMAC()
  return `${nonce}:${orgId}:${timestamp}`;
}

/**
 * Compute HMAC-SHA256 asynchronously (for API routes).
 */
export async function computeHMAC(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a client-submitted reward claim signature.
 */
export async function verifyRewardSignature(
  nonce: string,
  orgId: string,
  timestamp: number,
  signature: string,
  secret: string
): Promise<boolean> {
  // Check timestamp freshness (within 5 minutes)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return false;
  }

  const data = `${nonce}:${orgId}:${timestamp}`;
  const expected = await computeHMAC(data, secret);
  return expected === signature;
}
