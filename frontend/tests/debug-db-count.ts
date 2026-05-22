// Quick debug: count invoices via service_role (bypasses RLS)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get the most recently created invoices (from the last test run)
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, org_id, number, created_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Recent invoices:");
  for (const inv of invoices ?? []) {
    console.log(`  ${inv.number} | org: ${inv.org_id.slice(0, 8)}... | created: ${inv.created_at}`);
  }

  // Now count by org
  if (invoices?.length) {
    const orgId = invoices[0].org_id;
    const monthKey = "2026-05";
    const { count, error: countErr } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .gte("created_at", `${monthKey}-01`)
      .lt("created_at", "2026-06-01");

    console.log(`\nCount for org ${orgId.slice(0, 8)}... in ${monthKey}: ${count} (error: ${countErr?.message ?? "none"})`);
  }
}

main().catch(console.error);
