/**
 * Debug script: check what getCurrentMonthInvoiceCount returns
 * for a test org after creating invoices.
 *
 * Usage: npx tsx tests/debug-month-count.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create a test user
  const email = `debug-month-${Date.now()}@example.com`;
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email,
      password: "Password123!",
      email_confirm: true,
    });

  if (userError || !userData.user) {
    console.error("Failed to create user:", userError);
    return;
  }
  const userId = userData.user.id;
  console.log("User created:", userId);

  await new Promise((r) => setTimeout(r, 1000));

  // Get org
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member?.org_id) {
    console.error("No org found");
    await supabase.auth.admin.deleteUser(userId);
    return;
  }
  const orgId = member.org_id;
  console.log("Org:", orgId);

  // Create a client
  await supabase.from("clients").insert({
    org_id: orgId,
    name: "Test Client",
    email: "client@example.com",
  });

  // Create 5 invoices
  for (let i = 1; i <= 5; i++) {
    const { error } = await supabase.from("invoices").insert({
      org_id: orgId,
      client_id: "00000000-0000-0000-0000-000000000000", // placeholder, doesn't matter for count
      number: `INV-2026-${String(i).padStart(3, "0")}`,
      status: "draft",
      issue_date: "2026-05-19",
      due_date: "2026-06-18",
      subtotal: 100,
      tax_rate: 22,
      withholding_tax_rate: 20,
      total: 102,
      currency: "EUR",
    });
    console.log(`Invoice ${i}:`, error ? `ERROR: ${error.message}` : "OK");
  }

  // Now count using the same logic as getCurrentMonthInvoiceCount
  const monthKey = "2026-05";
  const { count, error: countError } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", `${monthKey}-01`)
    .lt("created_at", `${monthKey}-01`); // intentionally wrong for debug

  console.log("Count with month filter:", { count, error: countError?.message });

  // Also check created_at values
  const { data: invoices } = await supabase
    .from("invoices")
    .select("number, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  console.log("Invoice created_at values:");
  for (const inv of invoices ?? []) {
    console.log(`  ${inv.number}: ${inv.created_at}`);
  }

  // Now try the exact query from the code
  function getNextMonthKey(mk: string): string {
    const [y, m] = mk.split("-").map(Number);
    if (m === 12) return `${y + 1}-01`;
    return `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  const nextMonthKey = getNextMonthKey(monthKey);
  console.log("monthKey:", monthKey, "nextMonthKey:", nextMonthKey);

  const { count: count2, error: error2 } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", `${monthKey}-01`)
    .lt("created_at", nextMonthKey);

  console.log("Exact count:", { count: count2, error: error2?.message });

  // Cleanup
  await supabase.auth.admin.deleteUser(userId);
  console.log("Done");
}

main().catch(console.error);
