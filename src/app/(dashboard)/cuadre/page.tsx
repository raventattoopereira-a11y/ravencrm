import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import { CuadreClient } from "./cuadre-client";
import type { Client, PaymentMethod, Product, Service } from "@/lib/types/database";

export default async function CuadrePage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: paymentMethods }, { data: services }, { data: products }, { data: clients }] = await Promise.all([
    supabase.from("payment_methods").select("*").eq("is_active", true).order("sort_order") as unknown as Promise<{
      data: PaymentMethod[] | null;
    }>,
    supabase.from("services").select("*").eq("is_active", true).order("name") as unknown as Promise<{
      data: Service[] | null;
    }>,
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name") as unknown as Promise<{ data: Product[] | null }>,
    supabase.from("clients").select("*").order("name") as unknown as Promise<{ data: Client[] | null }>,
  ]);

  return (
    <CuadreClient
      initialDate={today}
      paymentMethods={paymentMethods ?? []}
      services={services ?? []}
      products={products ?? []}
      initialClients={clients ?? []}
    />
  );
}
