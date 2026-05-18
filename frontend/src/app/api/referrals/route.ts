import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * GET /api/referrals
 * Returns the current user's referral code and stats.
 * If no code exists, generates one.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get or create referral code
  const { data: org } = await supabase
    .from("organizations")
    .select("referral_code, referral_count")
    .eq("id", orgId)
    .single();

  let code = org?.referral_code;

  if (!code) {
    // Generate a short referral code from org name + random suffix
    const { data: orgName } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const base = (orgName?.name || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    code = `${base}-${suffix}`;

    await supabase
      .from("organizations")
      .update({ referral_code: code, referral_count: org?.referral_count || 0 })
      .eq("id", orgId);
  }

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/signup?ref=${code}`;

  return NextResponse.json({
    data: {
      code,
      referralLink,
      count: org?.referral_count || 0,
    },
  });
}
