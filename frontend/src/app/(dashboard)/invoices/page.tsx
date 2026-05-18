import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { InvoicesClient } from "@/components/invoices/InvoicesClient";
import type { Invoice } from "@/types";

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // Middleware guarantees auth, but TS needs the guard

  // Fetch invoices server-side with defense-in-depth org_id filter
  const supabase = await createClient();
  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  const orgId = memberData?.org_id;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name, email)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <InvoicesClient initialInvoices={(invoices as Invoice[]) || []} />
  );
}
