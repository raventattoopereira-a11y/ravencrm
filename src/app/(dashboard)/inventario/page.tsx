import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./inventario-client";
import type { Product } from "@/lib/types/database";

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = (await supabase.from("products").select("*").order("name")) as unknown as {
    data: Product[] | null;
  };

  return <InventarioClient initialProducts={data ?? []} />;
}
