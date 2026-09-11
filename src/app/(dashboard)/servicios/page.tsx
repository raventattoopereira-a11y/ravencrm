import { createClient } from "@/lib/supabase/server";
import { ServiciosClient } from "./servicios-client";
import type { Service } from "@/lib/types/database";

export default async function ServiciosPage() {
  const supabase = await createClient();
  const { data } = (await supabase.from("services").select("*").order("name")) as unknown as {
    data: Service[] | null;
  };
  return <ServiciosClient initialServices={data ?? []} />;
}
