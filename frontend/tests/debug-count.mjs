// Direct DB debug: check invoice count
// Usage: node tests/debug-count.mjs
import { createClient } from "@supabase/supabase-js";

// Read env manually
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
    console.log(`  ${inv.number} | org: ${inv.org_id?.slice(0, 8)}... | created: ${inv.created_at}`);
  }

  if (invoices?.length) {
    const orgId = invoices[0].org_id;
    const getNextMonth = (mk) => {
      const [y, m] = mk.split("-").map(Number);
      if (m === 12) return `${y + 1}-01`;
      return `${y}-${String(m + 1).padStart(2, "0")}`;
    };
    for (const monthKey of ["2026-04", "2026-05", "2026-06"]) {
      const nextKey = getNextMonth(monthKey);
      const { count, error: countErr } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .gte("created_at", `${monthKey}-01`)
        .lt("created_at", nextKey);
      
      console.log(`Count for org in ${monthKey} (lt ${nextKey}): ${count} (error: ${countErr?.message ?? "none"}, code: ${countErr?.code ?? "none"})`);
    }

    // Test is("deleted_at", null) alone
    console.log("--- is deleted_at null only ---");
    const { data: delData, error: delErr } = await supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .is("deleted_at", null);
    console.log(`is null: count=${delData?.length}, error=${delErr?.message ?? "none"}`);

    // Test with date range but NO deleted_at filter
    console.log("\n--- date range only ---");
    const { data: dateData, error: dateErr } = await supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .gte("created_at", "2026-05-01")
      .lt("created_at", "2026-06-01");
    console.log(`date range: count=${dateData?.length}, error=${dateErr?.message ?? "none"}`);

    // Test with exact nextKey values (missing day) — reproduce the bug
    console.log("\n--- head:true + select(*) + lt without day ---");
    const { count: c3, error: e3 } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .gte("created_at", "2026-05-01")
      .lt("created_at", "2026-06");  // <- missing -01
    console.log(`lt without day: count=${c3}, error=${e3?.message ?? "none"}`);

    // Test with correct nextKey (with day)
    console.log("\n--- head:true + select(*) + lt with day ---");
    const { count: c4, error: e4 } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .gte("created_at", "2026-05-01")
      .lt("created_at", "2026-06-01");  // <- correct
    console.log(`lt with day: count=${c4}, error=${e4?.message ?? "none"}`);
  }
}

main().catch(console.error);
