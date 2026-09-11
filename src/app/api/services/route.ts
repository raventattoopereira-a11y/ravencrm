import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/services/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const body = await request.json();
  const { data, error } = await supabase.from("services").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/services/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    // Likely a foreign key violation because this service is referenced by past transactions.
    const message = error.code === "23503"
      ? "No se puede eliminar: este servicio ya se usó en movimientos del cuadre. Desactívalo en su lugar."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
