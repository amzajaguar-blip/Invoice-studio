import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cron/check-overdue
 * Marks sent invoices past their due_date as "overdue".
 * Call via Vercel Cron / Supabase scheduled function / external cron every hour.
 *
 * Protected by CRON_SECRET header check.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Mark sent invoices past due_date as overdue
  const { error, count } = await supabase
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .eq("status", "sent")
    .lt("due_date", new Date().toISOString().slice(0, 10))
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log events for each marked invoice
  if (!error && count) {
    console.log(`Marked ${count} invoices as overdue`);
  }

  return NextResponse.json({
    success: true,
    marked_overdue: count ?? 0,
  });
}
