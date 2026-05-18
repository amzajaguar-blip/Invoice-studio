import type { Client } from "@/types";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ClientsClient } from "@/components/clients/ClientsClient";

export default async function ClientsPage() {
  await getCurrentUser();

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name");

  return <ClientsClient initialClients={(clients as Client[]) || []} />;
}
