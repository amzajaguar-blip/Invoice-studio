import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SettingsView } from "./SettingsView";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!memberData?.org_id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Nessuna organizzazione trovata.</p>
      </div>
    );
  }

  return <SettingsView orgId={memberData.org_id} />;
}
