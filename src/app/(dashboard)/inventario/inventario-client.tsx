"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardTitle, Input, Label, Badge } from "@/components/ui/primitives";
import { formatCOP } from "@/lib/utils";
import type { Product } from "@/lib/types/database";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";

const emptyForm = {
  id: "",
  name: "",
  sku: "",
  category: "General",
  unit: "unidad",
  stock_quantity: 0,
  min_stock: 0,
  cost_price: 0,
  sale_price: 0,
};

type FormState = typeof emptyForm;

export function InventarioClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, search]);

  function openNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      category: p.category,
      unit: p.unit,
      stock_quantity: p.stock_quantity,
      min_stock: p.min_stock,
      cost_price: p.cost_price,
      sale_price: p.sale_price,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category,
      unit: form.unit,
      stock_quantity: Number(form.stock_quantity),
      min_stock: Number(form.min_stock),
      cost_price: Number(form.cost_price),
      sale_price: Number(form.sale_price),
    };
    try {
      const res = form.id
        ? await fetch(`/api/products/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar el producto");
      setProducts((prev) => {
        if (form.id) return prev.map((p) => (p.id === form.id ? json.data : p));
        return [...prev, json.data];
      });
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("¿Desactivar este producto? Dejará de aparecer para nuevas ventas.")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted">Productos, stock y alertas de mínimos.</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Nuevo producto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o categoría…"
          className="pl-9"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Nombre</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>SKU (opcional)</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Stock actual</Label>
              <Input
                type="number"
                min={0}
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Stock mínimo</Label>
              <Input
                type="number"
                min={0}
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Precio de costo</Label>
              <Input
                type="number"
                min={0}
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Precio de venta</Label>
              <Input
                type="number"
                min={0}
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : form.id ? "Guardar cambios" : "Crear producto"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Productos ({filtered.length})</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Precio venta</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const low = Number(p.stock_quantity) <= Number(p.min_stock);
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3 text-muted">{p.category}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        {p.stock_quantity} {p.unit}
                        {low && <Badge tone="warning"><AlertTriangle size={10} className="mr-1" />bajo</Badge>}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatCOP(p.sale_price)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="text-muted hover:text-foreground">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDeactivate(p.id)} className="text-muted hover:text-accent">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted">
                    No hay productos que coincidan.
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
