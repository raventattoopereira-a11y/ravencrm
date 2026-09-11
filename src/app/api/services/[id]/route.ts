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
