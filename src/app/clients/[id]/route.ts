import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  birthday: z.string().nullable().optional().or(z.literal("")),
  instagram: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/clients/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { name, phone, email, birthday, instagram, notes } = parsed.data;
  const payload: Record<string, unknown> = {};
  if (name !== undefined) payload.name = name;
  if (phone !== undefined) payload.phone = phone || null;
  if (email !== undefined) payload.email = email || null;
  if (birthday !== undefined) payload.birthday = birthday || null;
  if (instagram !== undefined) payload.instagram = instagram || null;
  if (notes !== undefined) payload.notes = notes || null;

  const { data, error } = await supabase.from("clients").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/clients/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    // Likely a foreign key violation because this client is referenced by past transactions.
    const message = error.code === "23503"
      ? "No se puede eliminar: este cliente ya tiene movimientos registrados en el cuadre."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
