import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { getUserQuota } from "@/lib/plan";

/**
 * GET /api/rewards/status
 * Returns the current user's plan quota, invoice usage, and rewarded credits.
 * Called by the frontend to decide whether to show limit warnings or ad options.
 */
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = await getUserQuota(auth.orgId);

  return NextResponse.json({ data: quota });
}
