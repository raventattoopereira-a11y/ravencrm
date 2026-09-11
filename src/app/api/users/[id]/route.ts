import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.role === "string") patch.role = body.role;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.full_name === "string") patch.full_name = body.full_name;

  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const { userId } = await requireAdmin();
  const { id } = await ctx.params;
  if (id === userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
