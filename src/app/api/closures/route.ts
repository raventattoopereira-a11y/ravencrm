import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Falta el parámetro date" }, { status: 400 });

  const { data, error } = await supabase
    .from("daily_closures")
    .select("*")
    .eq("closure_date", date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const date: string | undefined = body?.date;
  const action: "open" | "close" | "reopen" = body?.action;
  if (!date || !action) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  if (action === "open") {
    const { data: existing } = await supabase
      .from("daily_closures")
      .select("*")
      .eq("closure_date", date)
      .maybeSingle();
    if (existing) return NextResponse.json({ data: existing });

    const { data, error } = await supabase
      .from("daily_closures")
      .insert({ closure_date: date, opened_by: user.id, status: "abierto" })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  if (action === "close") {
    const { data: txs, error: txError } = await supabase
      .from("transactions")
      .select("type, amount, payment_method:payment_methods(name)")
      .eq("transaction_date", date);
    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

    let totalIngresos = 0;
    let totalEgresos = 0;
    const byMethod: Record<string, number> = {};

    for (const t of txs ?? []) {
      const amount = Number(t.amount);
      const methodName = (t.payment_method as unknown as { name: string } | null)?.name ?? "Sin especificar";
      const signed = t.type === "ingreso" ? amount : -amount;
      byMethod[methodName] = (byMethod[methodName] ?? 0) + signed;
      if (t.type === "ingreso") totalIngresos += amount;
      else totalEgresos += amount;
    }

    const { data, error } = await supabase
      .from("daily_closures")
      .upsert(
        {
          closure_date: date,
          opened_by: user.id,
          closed_by: user.id,
          status: "cerrado",
          total_ingresos: totalIngresos,
          total_egresos: totalEgresos,
          totals_by_payment_method: byMethod,
          closed_at: new Date().toISOString(),
        },
        { onConflict: "closure_date" }
      )
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === "reopen") {
    const { data, error } = await supabase
      .from("daily_closures")
      .update({ status: "abierto", closed_by: null, closed_at: null })
      .eq("closure_date", date)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
