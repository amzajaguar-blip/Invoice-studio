import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * GET /api/admin/revenue-breakdown
 *
 * Admin-only endpoint for revenue dashboard.
 * Returns revenue breakdown by source (subscription, commission, ad_reward)
 * for the selected period.
 *
 * Query params:
 *   ?period=month|quarter|year  (default: month)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // TODO: Replace with proper admin role check
  // For MVP, any authenticated user can see aggregated revenue (not per-org)
  // In production: check against admin_users table or org_members.role = 'owner'

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month";

  let startDate: string;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (period) {
    case "quarter":
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        1
      ).toISOString();
      break;
    case "year":
      startDate = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        1
      ).toISOString();
      break;
    default:
      startDate = currentMonthStart.toISOString();
  }

  // ── Revenue by source ────────────────────────────────────────────────────
  const { data: breakdown } = await adminClient
    .from("revenue_events")
    .select("revenue_source, amount_cents, currency")
    .gte("created_at", startDate);

  const bySource: Record<
    string,
    { total_cents: number; count: number }
  > = {
    subscription: { total_cents: 0, count: 0 },
    commission: { total_cents: 0, count: 0 },
    ad_reward: { total_cents: 0, count: 0 },
  };

  for (const event of breakdown ?? []) {
    if (bySource[event.revenue_source]) {
      bySource[event.revenue_source].total_cents += event.amount_cents;
      bySource[event.revenue_source].count += 1;
    }
  }

  const totalCents = Object.values(bySource).reduce(
    (s, v) => s + v.total_cents,
    0
  );

  // ── Monthly trend (last 12 months by source) ─────────────────────────────
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const { data: trendData } = await adminClient
    .from("revenue_events")
    .select("revenue_source, amount_cents, recognition_period_start")
    .gte("recognition_period_start", twelveMonthsAgo.toISOString().slice(0, 10));

  // Group by month + source
  const trend: Record<string, Record<string, number>> = {};
  for (const event of trendData ?? []) {
    const month = (event.recognition_period_start as string).slice(0, 7);
    if (!trend[month]) {
      trend[month] = { subscription: 0, commission: 0, ad_reward: 0 };
    }
    trend[month][event.revenue_source] =
      (trend[month][event.revenue_source] ?? 0) + event.amount_cents;
  }

  const monthlyTrend = Object.entries(trend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, sources]) => ({
      month,
      subscription_eur: (sources.subscription / 100).toFixed(2),
      commission_eur: (sources.commission / 100).toFixed(2),
      ad_reward_eur: (sources.ad_reward / 100).toFixed(2),
      total_eur: (
        (sources.subscription + sources.commission + sources.ad_reward) /
        100
      ).toFixed(2),
    }));

  // ── Ad revenue: top users by impressions ─────────────────────────────────
  const { data: topAdUsers } = await adminClient
    .from("ad_impressions")
    .select("org_id, organizations(name)")
    .eq("verification_status", "verified")
    .gte("created_at", startDate)
    .limit(20);

  const adUserCounts: Record<string, { name: string; count: number }> = {};
  for (const row of topAdUsers ?? []) {
    const orgId = row.org_id;
    if (!adUserCounts[orgId]) {
      adUserCounts[orgId] = {
        name: (row as { organizations: { name: string }[] } | null)?.organizations?.[0]
          ?.name ?? "Unknown",
        count: 0,
      };
    }
    adUserCounts[orgId].count += 1;
  }

  const topUsers = Object.entries(adUserCounts)
    .map(([orgId, data]) => ({ org_id: orgId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    data: {
      period,
      start_date: startDate,
      end_date: now.toISOString(),
      breakdown: Object.fromEntries(
        Object.entries(bySource).map(([source, data]) => [
          source,
          {
            ...data,
            eur: (data.total_cents / 100).toFixed(2),
            percentage:
              totalCents > 0
                ? parseFloat(
                    ((data.total_cents / totalCents) * 100).toFixed(1)
                  )
                : 0,
          },
        ])
      ),
      total_cents: totalCents,
      total_eur: (totalCents / 100).toFixed(2),
      monthly_trend: monthlyTrend,
      top_ad_users: topUsers,
    },
  });
}
