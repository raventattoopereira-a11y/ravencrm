import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional().default(0),
});

const bodySchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: z.number().nonnegative(),
  payment_method_id: z.string().uuid().nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  client_name: z.string().max(160).nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  transaction_date: z.string(),
  items: z.array(itemSchema).optional().default([]),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Falta el parámetro date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, payment_method:payment_methods(name), service:services(name,type), client:clients(name), items:transaction_items(*, product:products(name))"
    )
    .eq("transaction_date", date)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const body = parsed.data;

  let clientId: string | null = null;
  if (body.client_name && body.client_name.trim()) {
    const name = body.client_name.trim();
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error: clientErr } = await supabase
        .from("clients")
        .insert({ name })
        .select("id")
        .single();
      if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 });
      clientId = created.id;
    }
  }

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: body.type,
      amount: body.amount,
      payment_method_id: body.payment_method_id ?? null,
      category: body.category ?? null,
      description: body.description ?? null,
      client_id: clientId,
      service_id: body.service_id ?? null,
      transaction_date: body.transaction_date,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  if (body.items.length > 0) {
    const rows = body.items.map((item) => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }));
    const { error: itemsError } = await supabase.from("transaction_items").insert(rows);
    if (itemsError) {
      return NextResponse.json(
        { error: `Movimiento creado, pero falló el descuento de inventario: ${itemsError.message}` },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ data: transaction }, { status: 201 });
}
