"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardTitle, Input, Label } from "@/components/ui/primitives";
import { CalendarDays, ExternalLink, Plus, Unlink } from "lucide-react";
import type { CalendarEventLite } from "@/lib/google/calendar";

const ERROR_MESSAGES: Record<string, string> = {
  no_refresh_token:
    "Google no devolvió un token de actualización. Ve a myaccount.google.com/permissions, revoca el acceso de la app e inténtalo de nuevo.",
  exchange_failed: "No se pudo completar la conexión con Google. Intenta de nuevo.",
  missing_code: "La autorización de Google no se completó.",
};

export function CalendarioClient({
  isAdmin,
  connected,
  initialEvents,
}: {
  isAdmin: boolean;
  connected: boolean;
  initialEvents: CalendarEventLite[];
}) {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const justConnected = searchParams.get("connected");

  const [events, setEvents] = useState(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  async function handleDisconnect() {
    if (!confirm("¿Desconectar Google Calendar del CRM?")) return;
    await fetch("/api/google/disconnect", { method: "POST" });
    window.location.reload();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/google/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          location: location || undefined,
          startISO: new Date(start).toISOString(),
          endISO: new Date(end).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear la cita");
      const refreshed = await fetch("/api/google/events?max=30").then((r) => r.json());
      setEvents(refreshed.data ?? []);
      setShowForm(false);
      setSummary("");
      setLocation("");
      setStart("");
      setEnd("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Calendario</h1>
          <p className="text-sm text-muted">Conecta Google Calendar para ver y crear citas desde cualquier parte.</p>
        </div>
        <Card className="text-center">
          <CalendarDays className="mx-auto mb-3 text-muted" size={32} />
          <p className="mb-4 text-sm text-muted">
            {errorCode
              ? ERROR_MESSAGES[errorCode] ?? "Ocurrió un error al conectar Google Calendar."
              : "Aún no hay ningún calendario de Google conectado a este CRM."}
          </p>
          {isAdmin ? (
            <a href="/api/google/oauth">
              <Button>Conectar Google Calendar</Button>
            </a>
          ) : (
            <p className="text-xs text-muted">Pide a un administrador que conecte el calendario.</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendario</h1>
          <p className="text-sm text-muted">Citas próximas del calendario conectado.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Nueva cita
          </Button>
          {isAdmin && (
            <Button variant="secondary" onClick={handleDisconnect}>
              <Unlink size={16} /> Desconectar
            </Button>
          )}
        </div>
      </div>

      {justConnected && (
        <p className="rounded-lg border border-green-900 bg-green-950 px-3 py-2 text-sm text-green-300">
          Google Calendar conectado correctamente.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input required value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Cita — Perforación oreja" />
            </div>
            <div>
              <Label>Inicio</Label>
              <Input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Ubicación (opcional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creando…" : "Crear cita"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Próximas citas</CardTitle>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay citas próximas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{ev.summary}</p>
                  <p className="text-xs text-muted">
                    {ev.start ? new Date(ev.start).toLocaleString("es-CO") : ""}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </p>
                </div>
                {ev.htmlLink && (
                  <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
                    <ExternalLink size={15} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
