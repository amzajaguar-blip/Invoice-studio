// ─── Scanner Page — OCR Intake Engine V21 ───

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ScannerView } from "./ScannerView";

export const metadata = {
  title: "OCR Scanner — InvoiceStudio",
  description: "Importa fatture con OCR assistito",
};

export default async function ScannerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member?.org_id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)]">
          Nessuna organizzazione trovata. Contatta il supporto.
        </p>
      </div>
    );
  }

  return <ScannerView orgId={member.org_id} />;
}
