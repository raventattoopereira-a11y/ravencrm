"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardTitle, Input, Label } from "@/components/ui/primitives";
import type { Client } from "@/lib/types/database";
import { Plus, Pencil, Trash2, Search, Cake, AtSign } from "lucide-react";

const emptyForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  birthday: "",
  instagram: "",
  notes: "",
};

type FormState = typeof emptyForm;

function formatBirthday(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function ClientesClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editingId = form.id || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.instagram ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  function openNew() {
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      birthday: c.birthday ?? "",
      instagram: c.instagram ?? "",
      notes: c.notes ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      birthday: form.birthday,
      instagram: form.instagram,
      notes: form.notes,
    };
    try {
      const res = editingId
        ? await fetch(`/api/clients/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el cliente");
      setClients((prev) =>
        editingId
          ? prev.map((c) => (c.id === editingId ? json.data : c)).sort((a, b) => a.name.localeCompare(b.name))
          : [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c: Client) {
    if (!confirm(`¿Eliminar a "${c.name}"? Esto no se puede deshacer.`)) return;
    setError(null);
    const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "No se pudo eliminar el cliente");
      return;
    }
    setClients((prev) => prev.filter((it) => it.id !== c.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted">Registro de clientes del estudio.</p>
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
          <Plus size={16} /> {showForm ? "Cancelar" : "Nuevo cliente"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Nombre y apellidos</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="300 000 0000"
              />
            </div>
            <div>
              <Label>Fecha de cumpleaños</Label>
              <Input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              />
            </div>
            <div>
              <Label>Correo</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="@usuario"
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : editingId ? "Guardar cambios" : "Crear cliente"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setForm(emptyForm);
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Clientes ({filtered.length})</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, correo…"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Correo</th>
                <th className="py-2 pr-3">Cumpleaños</th>
                <th className="py-2 pr-3">Instagram</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{c.name}</td>
                  <td className="py-2 pr-3 text-muted">{c.phone || "—"}</td>
                  <td className="py-2 pr-3 text-muted">{c.email || "—"}</td>
                  <td className="py-2 pr-3 text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Cake size={13} /> {formatBirthday(c.birthday)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {c.instagram ? (
                      <span className="inline-flex items-center gap-1">
                        <AtSign size={13} /> {c.instagram}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="text-muted hover:text-foreground">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(c)} className="text-muted hover:text-accent">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted">
                    {clients.length === 0 ? "Aún no hay clientes registrados." : "Sin resultados para tu búsqueda."}
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
