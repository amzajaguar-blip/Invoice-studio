import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/reconcile-admob
 *
 * Daily job: compares internal ad_impressions counts with AdMob reporting API.
 * Flags discrepancies >2% for manual review.
 *
 * Protected by CRON_SECRET header.
 *
 * Runs at 02:00 UTC daily (AdMob reports for previous day are finalized by then).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const reportDate = yesterday.toISOString().slice(0, 10);

  // ── 1. Aggregate internal metrics ─────────────────────────────────────────
  const { data: internalAgg } = await adminClient
    .from("ad_impressions")
    .select("count")
    .eq("verification_status", "verified")
    .gte("created_at", `${reportDate}T00:00:00Z`)
    .lt("created_at", `${reportDate}T23:59:59Z`);

  const internalImpressions = (internalAgg ?? []).length;

  // Sum estimated earnings from verified impressions
  const { data: earningsRows } = await adminClient
    .from("ad_impressions")
    .select("estimated_earnings_usd_micros")
    .eq("verification_status", "verified")
    .gte("created_at", `${reportDate}T00:00:00Z`)
    .lt("created_at", `${reportDate}T23:59:59Z`)
    .not("estimated_earnings_usd_micros", "is", null);

  const internalEarningsUsdMicros = (earningsRows ?? []).reduce(
    (sum, row) => sum + (row.estimated_earnings_usd_micros ?? 0),
    0
  );

  // ── 2. Fetch AdMob report ────────────────────────────────────────────────
  //
  // TODO: Implement Google AdMob API call using a service account.
  //
  // const admobReport = await fetchAdMobReport(reportDate);
  //
  // Google AdMob API endpoint:
  //   POST https://admob.googleapis.com/v1/accounts/{publisherId}/mediationReport:generate
  //
  // For now, insert a pending reconciliation record.
  // In production, this would compare internal vs AdMob and set status accordingly.

  const { data: existingRecon } = await adminClient
    .from("admob_reconciliation_results")
    .select("id")
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existingRecon) {
    // Update existing record (e.g., if AdMob data became available later)
    await adminClient
      .from("admob_reconciliation_results")
      .update({
        internal_impressions: internalImpressions,
        internal_earnings_usd_micros: internalEarningsUsdMicros,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRecon.id);
  } else {
    await adminClient.from("admob_reconciliation_results").insert({
      report_date: reportDate,
      internal_impressions: internalImpressions,
      internal_earnings_usd_micros: internalEarningsUsdMicros,
      status: "pending",
      notes:
        "AdMob API integration pending — manual reconciliation required. " +
        "Set admob_impressions and admob_earnings_usd_micros manually until API is integrated.",
    });
  }

  // ── 3. Backfill revenue_events with AdMob earnings ───────────────────────
  //
  // Once AdMob API is integrated, update the revenue_events rows for yesterday:
  //
  //   UPDATE public.revenue_events
  //   SET amount_cents = (admob_earnings_usd_micros / 10000)::integer,
  //       recognized_amount_cents = (admob_earnings_usd_micros / 10000)::integer
  //   WHERE revenue_source = 'ad_reward'
  //     AND created_at::date = '${reportDate}';
  //
  // The conversion from USD micros to EUR cents requires the ECB exchange rate.
  // Use the ECB daily rate for the report date.

  // ── 4. Detect discrepancies (when AdMob data is available) ────────────────
  const { data: reconciled } = await adminClient
    .from("admob_reconciliation_results")
    .select("*")
    .eq("report_date", reportDate)
    .not("admob_impressions", "is", null)
    .single();

  if (reconciled) {
    const impressionDelta =
      (reconciled.admob_impressions ?? 0) - internalImpressions;
    const earningsDelta =
      (reconciled.admob_earnings_usd_micros ?? 0) - internalEarningsUsdMicros;
    const deltaPct =
      (reconciled.admob_impressions ?? 0) > 0
        ? (Math.abs(impressionDelta) / reconciled.admob_impressions!) * 100
        : 0;

    let status: string = "matched";
    if (deltaPct > 5) {
      status = "discrepancy";
      console.warn(
        `AdMob reconciliation discrepancy: ${deltaPct.toFixed(1)}% for ${reportDate}`
      );
    } else if (deltaPct > 2) {
      status = "discrepancy"; // flagged but low severity
    }

    await adminClient
      .from("admob_reconciliation_results")
      .update({
        impression_delta: impressionDelta,
        earnings_delta_usd_micros: earningsDelta,
        delta_pct: parseFloat(deltaPct.toFixed(2)),
        status,
      })
      .eq("id", reconciled.id);
  }

  return NextResponse.json({
    data: {
      report_date: reportDate,
      internal_impressions: internalImpressions,
      internal_earnings_usd_micros: internalEarningsUsdMicros,
      status: "reconciliation_complete",
      ad_mob_api_integrated: false, // Set to true once Google API is wired up
    },
  });
}
