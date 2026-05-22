import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/reset-credits
 *
 * Scheduled job: resets org_credits at the start of each month.
 * Called by Vercel Cron or external scheduler at 00:01 UTC on the 1st.
 *
 * Protected by CRON_SECRET header — unauthorized requests return 401.
 *
 * Idempotent: each org_credits row is only reset once per period
 * (guarded by current_period_end < CURRENT_DATE condition in the stored procedure).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  try {
    // Call the stored procedure that handles atomic reset
    const { error } = await adminClient.rpc("reset_org_credits_period");

    if (error) {
      console.error("Credit reset failed:", error);
      return NextResponse.json(
        { error: "Credit reset procedure failed" },
        { status: 500 }
      );
    }

    // Count how many orgs were affected
    const { data: resetOrgs } = await adminClient
      .from("credit_transactions")
      .select("org_id", { count: "exact" })
      .eq("entry_type", "expire")
      .gte("created_at", new Date().toISOString().slice(0, 10));

    return NextResponse.json({
      data: {
        status: "completed",
        date: new Date().toISOString().slice(0, 10),
        orgs_reset: resetOrgs?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("Credit reset cron error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
