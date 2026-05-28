import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getUserQuota } from "@/lib/plan";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Fetch org data
  const { data: memberData } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  const orgId = memberData?.org_id ?? null;

  const { data: org } = orgId
    ? await supabase
        .from("organizations")
        .select("id, name, plan, iban, brand_color")
        .eq("id", orgId)
        .single()
    : { data: null };

  // Quota info
  const quota = orgId ? await getUserQuota(orgId) : null;

  return (
    <SettingsClient
      user={{
        id: user.id,
        email: user.email ?? "",
        fullName: user.user_metadata?.full_name ?? "",
      }}
      org={org ?? null}
      quota={quota}
      role={memberData?.role ?? "member"}
    />
  );
}
