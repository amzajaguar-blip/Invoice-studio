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
 * Reads from org_credits (unified wallet), consistent with mobile app.
 */
export async function getRewardedCredits(orgId: string): Promise<{
  credits: number;
  maxCredits: number;
}> {
  const supabase = await createClient();

  // Read from org_credits (unified wallet — same table the mobile app writes to)
  const { data: wallet } = await supabase
    .from("org_credits")
    .select("earned_credits, consumed_credits")
    .eq("org_id", orgId)
    .maybeSingle();

  const earned = wallet?.earned_credits ?? 0;
  const consumed = wallet?.consumed_credits ?? 0;
  const available = Math.max(0, earned - consumed);

  // Fetch max credits cap from rewarded_ad_config
  const { data: config } = await supabase
    .from("rewarded_ad_config")
    .select("max_rewarded_invoices_month")
    .single();

  return {
    credits: available,
    maxCredits: config?.max_rewarded_invoices_month ?? 3,
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
 * Uses ad_impressions as idempotency gate (UNIQUE on verification_hash),
 * then upserts org_credits and inserts credit_transactions ledger entry.
 */
export async function grantRewardedCredit(
  orgId: string,
  userId: string,
  verificationHash: string,
  adProvider: string = "admob",
  rewardAmount: number = 1
): Promise<{ success: boolean; creditsGranted: number; totalCredits: number; error?: string }> {
  const supabase = await createClient();
  const quota = getPlanQuota(await getOrgPlan(orgId));

  if (!quota.rewardedAdsEnabled) {
    return { success: false, creditsGranted: 0, totalCredits: 0, error: "Rewarded ads not available on this plan" };
  }

  // 1. Insert ad_impressions as idempotency gate (UNIQUE on admob_callback_id)
  const { error: impressionError } = await supabase.from("ad_impressions").insert({
    org_id: orgId,
    user_id: userId,
    admob_callback_id: verificationHash,
    ad_unit_id: "ssv_" + adProvider,
    reward_type: "invoice_credit",
    reward_amount: rewardAmount,
    verification_status: "verified",
    verified_at: new Date().toISOString(),
  });

  if (impressionError) {
    // Duplicate claim (UNIQUE violation) — already processed
    if (impressionError.code === "23505") {
      const { data: existing } = await supabase
        .from("org_credits")
        .select("earned_credits, consumed_credits")
        .eq("org_id", orgId)
        .maybeSingle();
      const total = Math.max(0, (existing?.earned_credits ?? 0) - (existing?.consumed_credits ?? 0));
      return { success: true, creditsGranted: 0, totalCredits: total };
    }
    return { success: false, creditsGranted: 0, totalCredits: 0, error: "Failed to record ad impression" };
  }

  // 2. Upsert org_credits (unified wallet)
  const { data: current } = await supabase
    .from("org_credits")
    .select("id, earned_credits, consumed_credits")
    .eq("org_id", orgId)
    .maybeSingle();

  const maxCredits = quota.maxRewardedCredits;

  if (current) {
    const currentAvailable = current.earned_credits - current.consumed_credits;
    if (currentAvailable >= maxCredits) {
      return { success: true, creditsGranted: 0, totalCredits: currentAvailable };
    }
    const newEarned = current.earned_credits + rewardAmount;
    const balanceAfter = newEarned - current.consumed_credits;
    const cappedEarned = Math.min(newEarned, current.consumed_credits + maxCredits);

    await supabase
      .from("org_credits")
      .update({ earned_credits: cappedEarned, updated_at: new Date().toISOString() })
      .eq("org_id", orgId);

    // 3. Insert credit_transactions ledger entry
    await supabase.from("credit_transactions").insert({
      org_id: orgId,
      entry_type: "earn",
      amount: rewardAmount,
      idempotency_key: `earn_${verificationHash}_${orgId}`,
      balance_after: Math.min(balanceAfter, maxCredits),
      reason: "Rewarded ad claim via SSV",
    });

    return {
      success: true,
      creditsGranted: cappedEarned - current.earned_credits,
      totalCredits: cappedEarned - current.consumed_credits,
    };
  }

  // First credit for this org
  await supabase.from("org_credits").insert({
    org_id: orgId,
    earned_credits: 1,
    consumed_credits: 0,
  });

  await supabase.from("credit_transactions").insert({
    org_id: orgId,
    entry_type: "earn",
    amount: 1,
    idempotency_key: `earn_${verificationHash}_${orgId}`,
    balance_after: 1,
    reason: "Rewarded ad claim via SSV (first credit)",
  });

  return { success: true, creditsGranted: 1, totalCredits: 1 };
}

/**
 * Consume one rewarded credit for invoice creation beyond the base plan limit.
 * Increments consumed_credits on org_credits and records a credit_transactions
 * entry_type='consume'.
 *
 * Idempotent via invoice_id: each invoice can consume at most one credit,
 * enforced by UNIQUE(idempotency_key) on credit_transactions.
 */
export async function consumeRewardedCredit(
  orgId: string,
  invoiceId: string
): Promise<{ consumed: boolean; remainingCredits: number }> {
  const supabase = await createClient();

  // Guard: check if this invoice already consumed a credit (idempotency)
  const idempotencyKey = `consume_${invoiceId}_${orgId}`;
  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingTx) {
    // Already consumed — return current balance
    const { data: credits } = await supabase
      .from("org_credits")
      .select("earned_credits, consumed_credits")
      .eq("org_id", orgId)
      .maybeSingle();
    const remaining = Math.max(0, (credits?.earned_credits ?? 0) - (credits?.consumed_credits ?? 0));
    return { consumed: false, remainingCredits: remaining };
  }

  // Fetch current wallet
  const { data: current } = await supabase
    .from("org_credits")
    .select("earned_credits, consumed_credits")
    .eq("org_id", orgId)
    .maybeSingle();

  const earned = current?.earned_credits ?? 0;
  const consumed = current?.consumed_credits ?? 0;
  const available = earned - consumed;

  if (available <= 0) {
    return { consumed: false, remainingCredits: 0 };
  }

  const newConsumed = consumed + 1;
  const balanceAfter = earned - newConsumed;

  // Increment consumed_credits
  await supabase
    .from("org_credits")
    .update({ consumed_credits: newConsumed, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);

  // Record the consumption in the ledger
  await supabase.from("credit_transactions").insert({
    org_id: orgId,
    entry_type: "consume",
    amount: 1,
    invoice_id: invoiceId,
    idempotency_key: idempotencyKey,
    balance_after: balanceAfter,
    reason: `Invoice ${invoiceId} created with rewarded credit`,
  });

  // Also record in invoice_events for backward compatibility
  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    event_type: "rewarded_credit_used",
    metadata: {
      credits_before: available,
      credits_after: balanceAfter,
    },
  });

  return { consumed: true, remainingCredits: balanceAfter };
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
