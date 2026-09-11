"use client";

import { useState } from "react";
import { Button, Card, CardTitle, Input, Label, Select, Badge } from "@/components/ui/primitives";
import { formatCOP } from "@/lib/utils";
import type { Service, ServiceType } from "@/lib/types/database";
import { Plus, Pencil, Trash2 } from "lucide-react";

const TYPE_LABEL: Record<ServiceType, string> = {
  perforacion: "Perforación",
  joyeria: "Joyería",
  tatuaje: "Tatuaje",
  otro: "Otro",
};

export function ServiciosClient({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<ServiceType>("perforacion");
  const [basePrice, setBasePrice] = useState("0");

  function resetForm() {
    setEditingId(null);
    setName("");
    setType("perforacion");
    setBasePrice("0");
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setName(s.name);
    setType(s.type);
    setBasePrice(String(s.base_price));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = { name, type, base_price: Number(basePrice) };
    try {
      const res = editingId
        ? await fetch(`/api/services/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/services", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el servicio");
      setServices((prev) =>
        editingId ? prev.map((s) => (s.id === editingId ? json.data : s)) : [...prev, json.data]
      );
      setShowForm(false);
      resetForm();
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

  async function handleDelete(s: Service) {
    if (!confirm(`¿Eliminar "${s.name}"? Esto no se puede deshacer.`)) return;
    setError(null);
    const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "No se pudo eliminar el servicio");
      return;
    }
    setServices((prev) => prev.filter((it) => it.id !== s.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted">
            Catálogo usado en el cuadre diario. Los tipos “Perforación” y “Joyería” permiten descontar inventario.
          </p>
        </div>
        <Button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
            } else {
              openNew();
            }
          }}
        >
          <Plus size={16} /> {showForm ? "Cancelar" : "Nuevo servicio"}
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
                <option value="joyeria">Joyería</option>
                <option value="tatuaje">Tatuaje</option>
                <option value="otro">Otro</option>
              </Select>
            </div>
            <div>
              <Label>Precio base</Label>
              <Input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear servicio"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancelar edición
                </Button>
              )}
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
                <th className="py-2 pr-3"></th>
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
                  <td className="py-2 pr-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(s)} className="text-muted hover:text-foreground">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-muted hover:text-accent">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted">
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
