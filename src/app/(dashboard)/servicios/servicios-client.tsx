"use client";

import { useState } from "react";
import { Button, Card, CardTitle, Input, Label, Select, Badge } from "@/components/ui/primitives";
import { formatCOP } from "@/lib/utils";
import type { Service, ServiceType } from "@/lib/types/database";
import { Plus } from "lucide-react";

const TYPE_LABEL: Record<ServiceType, string> = {
  perforacion: "Perforación",
  tatuaje: "Tatuaje",
  otro: "Otro",
};

export function ServiciosClient({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<ServiceType>("perforacion");
  const [basePrice, setBasePrice] = useState("0");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, base_price: Number(basePrice) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el servicio");
      setServices((prev) => [...prev, json.data]);
      setShowForm(false);
      setName("");
      setBasePrice("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(s: Service) {
    const res = await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    if (res.ok) {
      setServices((prev) => prev.map((it) => (it.id === s.id ? { ...it, is_active: !it.is_active } : it)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted">
            Catálogo usado en el cuadre diario. Marca un servicio como “Perforación” para poder descontar inventario.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Nuevo servicio
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Nombre</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Perforación de oreja" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as ServiceType)}>
                <option value="perforacion">Perforación</option>
                <option value="tatuaje">Tatuaje</option>
                <option value="otro">Otro</option>
              </Select>
            </div>
            <div>
              <Label>Precio base</Label>
              <Input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Crear servicio"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Catálogo ({services.length})</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Precio base</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  <td className="py-2 pr-3 text-muted">{TYPE_LABEL[s.type]}</td>
                  <td className="py-2 pr-3">{formatCOP(s.base_price)}</td>
                  <td className="py-2 pr-3">
                    <button onClick={() => toggleActive(s)}>
                      <Badge tone={s.is_active ? "success" : "neutral"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    Aún no hay servicios. Crea al menos uno de tipo “Perforación”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
