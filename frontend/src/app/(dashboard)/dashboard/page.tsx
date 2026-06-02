import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Get org_id and quick count for static shell
  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!memberData?.org_id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)]">
          Nessuna organizzazione trovata. Contatta il supporto.
        </p>
      </div>
    );
  }

  // Quick count for static welcome card
  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", memberData.org_id)
    .is("deleted_at", null);

  return (
    <DashboardView
      orgId={memberData.org_id}
      userName={user.user_metadata?.full_name ?? ""}
      invoiceCount={invoiceCount ?? 0}
    />
  );
}
