import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { WeeklyChart, type DailyPoint } from "@/components/dashboard/weekly-chart";
import { formatCOP, formatDate, todayISO } from "@/lib/utils";
import type { Transaction, Product } from "@/lib/types/database";
import { AlertTriangle, TrendingUp, TrendingDown, Scale, CalendarClock } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString().slice(0, 10);

  const [{ data: weekTx }, { data: lowStock }, events] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("transaction_date", sevenDaysAgoISO)
      .order("transaction_date", { ascending: true }) as unknown as Promise<{ data: Transaction[] | null }>,
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true }) as unknown as Promise<{ data: Product[] | null }>,
    listUpcomingEvents(5).catch(() => null),
  ]);

  const todayTx = (weekTx ?? []).filter((t) => t.transaction_date === today);
  const totalIngresosHoy = todayTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + Number(t.amount), 0);
  const totalEgresosHoy = todayTx.filter((t) => t.type === "egreso").reduce((s, t) => s + Number(t.amount), 0);
  const balanceHoy = totalIngresosHoy - totalEgresosHoy;

  const lowStockProducts = (lowStock ?? []).filter((p) => Number(p.stock_quantity) <= Number(p.min_stock));

  // Build the last 7 days series (fills days with no transactions as 0)
  const dayLabels: DailyPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayTx = (weekTx ?? []).filter((t) => t.transaction_date === iso);
    dayLabels.push({
      label: d.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", ""),
      ingresos: dayTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + Number(t.amount), 0),
      egresos: dayTx.filter((t) => t.type === "egreso").reduce((s, t) => s + Number(t.amount), 0),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="text-sm text-muted">Hoy, {formatDate(today)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Ingresos de hoy</CardTitle>
            <TrendingUp size={16} className="text-success" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{formatCOP(totalIngresosHoy)}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Egresos de hoy</CardTitle>
            <TrendingDown size={16} className="text-accent" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{formatCOP(totalEgresosHoy)}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Balance de hoy</CardTitle>
            <Scale size={16} className="text-muted" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${balanceHoy < 0 ? "text-accent" : "text-foreground"}`}>
            {formatCOP(balanceHoy)}
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Últimos 7 días</CardTitle>
        <div className="mt-3">
          <WeeklyChart data={dayLabels} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Stock bajo</CardTitle>
            <Link href="/inventario" className="text-xs text-accent hover:underline">
              Ver inventario
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted">Todo el inventario está por encima del mínimo.</p>
          ) : (
            <ul className="space-y-2">
              {lowStockProducts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-warning" />
                    {p.name}
                  </span>
                  <Badge tone="warning">
                    {p.stock_quantity} / min {p.min_stock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Próximas citas (Google Calendar)</CardTitle>
            <Link href="/calendario" className="text-xs text-accent hover:underline">
              Ver calendario
            </Link>
          </div>
          {events === null ? (
            <p className="text-sm text-muted">
              El calendario de Google aún no está conectado.{" "}
              <Link href="/calendario" className="text-accent hover:underline">
                Conectar ahora
              </Link>
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted">No hay citas próximas.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-sm">
                  <CalendarClock size={14} className="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <p className="font-medium">{ev.summary}</p>
                    <p className="text-xs text-muted">
                      {ev.start ? new Date(ev.start).toLocaleString("es-CO") : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
