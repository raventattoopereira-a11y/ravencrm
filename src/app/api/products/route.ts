import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  category: z.string().min(1).default("General"),
  unit: z.string().min(1).default("unidad"),
  stock_quantity: z.number().nonnegative().default(0),
  min_stock: z.number().nonnegative().default(0),
  cost_price: z.number().nonnegative().default(0),
  sale_price: z.number().nonnegative().default(0),
});

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { data, error } = await supabase.from("products").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
