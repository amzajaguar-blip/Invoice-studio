import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * POST /api/cron/check-overdue
 * Marks sent invoices past their due_date as "overdue".
 * Also sends push notifications to affected users via Expo Push Service.
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
  const today = new Date().toISOString().slice(0, 10);

  // Fetch overdue invoices with org info before updating
  const { data: overdueInvoices, error: fetchError } = await supabase
    .from("invoices")
    .select("id, number, total, org_id, org_members!inner(user_id)")
    .eq("status", "sent")
    .lt("due_date", today)
    .is("deleted_at", null);

  if (fetchError) {
    console.error("check-overdue fetch error:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Mark all as overdue
  const { error: updateError, count } = await supabase
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .eq("status", "sent")
    .lt("due_date", today)
    .is("deleted_at", null)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`Marked ${count ?? 0} invoices as overdue`);

  // Send push notifications to users with overdue invoices
  type OrgMember = { user_id: string };
  type OverdueInvoice = { id: string; number: string; total: number | null; org_id: string; org_members: OrgMember[] };

  if (overdueInvoices && overdueInvoices.length > 0) {
    // Collect unique user IDs from org_members
    const userIds = [...new Set(
      (overdueInvoices as OverdueInvoice[]).flatMap((inv) =>
        (inv.org_members ?? []).map((m) => m.user_id)
      )
    )];

    if (userIds.length > 0) {
      // Get push tokens for those users
      const { data: tokenRows } = await supabase
        .from("user_push_tokens")
        .select("user_id, token")
        .in("user_id", userIds);

      if (tokenRows && tokenRows.length > 0) {
        const fmt = (n: number) =>
          new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

        const messages = tokenRows.map((row: { user_id: string; token: string }) => {
          const userInvoices = (overdueInvoices as OverdueInvoice[]).filter((inv) =>
            (inv.org_members ?? []).some((m) => m.user_id === row.user_id)
          );
          const total = userInvoices.reduce((s: number, inv) => s + (inv.total ?? 0), 0);
          const count = userInvoices.length;
          return {
            to: row.token,
            title: "⚠️ Fatture scadute",
            body:
              count === 1
                ? `La fattura #${userInvoices[0].number} è scaduta (${fmt(total)}). Invia un promemoria!`
                : `${count} fatture scadute per un totale di ${fmt(total)}. Controlla ora.`,
            data: { type: "invoice_overdue" },
            sound: "default",
            badge: count,
            channelId: "invoicestudio",
          };
        });

        try {
          await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(messages),
          });
        } catch (pushErr) {
          // Non-fatal — log and continue
          console.error("Push delivery error:", pushErr);
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    marked_overdue: count ?? 0,
  });
}
