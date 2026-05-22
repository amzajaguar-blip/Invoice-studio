import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";

/**
 * GET /api/ads/credits
 * Returns the current user's credit balance, quota usage, and reward eligibility.
 * Used by the frontend to display "Watch Ad" button and remaining invoice count.
 */
export async function GET() {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch org plan
  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();

  // Fetch credit wallet
  const { data: credits } = await supabase
    .from("org_credits")
    .select("earned_credits, consumed_credits, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  // Count monthly invoices for quota
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: monthlyInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", monthStart.toISOString());

  // Fetch ad config
  const { data: adConfig } = await supabase
    .from("rewarded_ad_config")
    .select("max_rewarded_invoices_month, enabled")
    .single();

  const plan = org?.plan ?? "free";
  const isFree = plan === "free";
  const freeLimit = 5;
  const earnedCredits = credits?.earned_credits ?? 0;
  const consumedCredits = credits?.consumed_credits ?? 0;
  const availableCredits = earnedCredits - consumedCredits;
  const maxRewarded = adConfig?.max_rewarded_invoices_month ?? 3;
  const rewardsEnabled = adConfig?.enabled ?? false;

  // How many extra invoices can this user unlock via ads this month?
  const remainingRewardSlots = Math.max(
    0,
    maxRewarded - earnedCredits
  );

  const quotaUsed = monthlyInvoices ?? 0;
  const quotaRemaining = isFree ? Math.max(0, freeLimit - quotaUsed) : null;
  const canCreate =
    !isFree || quotaUsed < freeLimit || availableCredits > 0;

  // Show "watch ad" button when:
  // - Free plan
  // - Rewards enabled
  // - Quota exhausted (or about to be)
  // - Haven't hit monthly reward cap
  // - Haven't hit daily cap (checked client-side too)
  const shouldShowAdOption =
    isFree &&
    rewardsEnabled &&
    quotaUsed >= freeLimit &&
    remainingRewardSlots > 0;

  return NextResponse.json({
    data: {
      plan,
      invoice_quota: isFree
        ? {
            limit: freeLimit,
            used: quotaUsed,
            remaining: quotaRemaining,
          }
        : null,
      credits: {
        earned: earnedCredits,
        consumed: consumedCredits,
        available: availableCredits,
        max_per_month: maxRewarded,
        remaining_slots: remainingRewardSlots,
        expires_at: credits?.current_period_end ?? null,
      },
      can_create_invoice: canCreate,
      rewards_enabled: rewardsEnabled,
      show_ad_option: shouldShowAdOption,
    },
  });
}
