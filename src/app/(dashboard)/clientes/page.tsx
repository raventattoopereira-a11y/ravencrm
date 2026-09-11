import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./clientes-client";
import type { Client } from "@/lib/types/database";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = (await supabase.from("clients").select("*").order("name")) as unknown as {
    data: Client[] | null;
  };
  return <ClientesClient initialClients={data ?? []} />;
}
