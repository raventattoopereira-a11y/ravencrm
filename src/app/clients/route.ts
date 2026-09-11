import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  birthday: z.string().nullable().optional().or(z.literal("")),
  instagram: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { name, phone, email, birthday, instagram, notes } = parsed.data;
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      phone: phone || null,
      email: email || null,
      birthday: birthday || null,
      instagram: instagram || null,
      notes: notes || null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
