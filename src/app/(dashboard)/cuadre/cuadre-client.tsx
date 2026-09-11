"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button, Card, CardTitle, Input, Label, Select, Textarea, Badge } from "@/components/ui/primitives";
import { formatCOP } from "@/lib/utils";
import type { Client, PaymentMethod, Product, Service } from "@/lib/types/database";
import { ARTISTS } from "@/lib/artists";
import { Plus, Trash2, Lock, Unlock, X, UserPlus, Check } from "lucide-react";

interface TxRow {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  payment_method: { name: string } | null;
  service: { name: string; type: string } | null;
  client: { name: string } | null;
  performed_by: string | null;
  items: { id: string; quantity: number; product: { name: string } | null }[];
}

interface Closure {
  id: string;
  closure_date: string;
  status: "abierto" | "cerrado";
  total_ingresos: number;
  total_egresos: number;
  totals_by_payment_method: Record<string, number>;
}

interface ItemDraft {
  product_id: string;
  quantity: number;
}

export function CuadreClient({
  initialDate,
  paymentMethods,
  services,
  products,
  initialClients,
}: {
  initialDate: string;
  paymentMethods: PaymentMethod[];
  services: Service[];
  products: Product[];
  initialClients: Client[];
}) {
  const [date, setDate] = useState(initialDate);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [closure, setClosure] = useState<Closure | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<"ingreso" | "egreso">("ingreso");
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientBirthday, setNewClientBirthday] = useState("");
  const [newClientInstagram, setNewClientInstagram] = useState("");
  const clientBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  const exactClientMatch = clients.find((c) => c.name.toLowerCase() === clientQuery.trim().toLowerCase());

  function selectClient(c: Client) {
    setClientId(c.id);
    setClientQuery(c.name);
    setClientDropdownOpen(false);
    setShowNewClientForm(false);
  }

  function resetNewClientForm() {
    setNewClientPhone("");
    setNewClientEmail("");
    setNewClientBirthday("");
    setNewClientInstagram("");
  }

  function openNewClientForm() {
    setClientDropdownOpen(false);
    resetNewClientForm();
    setShowNewClientForm(true);
  }

  async function submitNewClient(e: React.FormEvent) {
    e.preventDefault();
    const name = clientQuery.trim();
    if (!name) return;
    setCreatingClient(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: newClientPhone || null,
          email: newClientEmail || null,
          birthday: newClientBirthday || null,
          instagram: newClientInstagram || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el cliente");
      setClients((prev) => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      selectClient(json.data);
      resetNewClientForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado creando el cliente");
    } finally {
      setCreatingClient(false);
    }
  }

  const selectedService = services.find((s) => s.id === serviceId);
  // Perforación and Joyería both consume inventory items picked manually below.
  const consumesInventory = selectedService?.type === "perforacion" || selectedService?.type === "joyeria";

  const loadDay = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, closureRes] = await Promise.all([
        fetch(`/api/transactions?date=${d}`).then((r) => r.json()),
        fetch(`/api/closures?date=${d}`).then((r) => r.json()),
      ]);
      if (txRes.error) throw new Error(txRes.error);
      if (closureRes.error) throw new Error(closureRes.error);
      setTransactions(txRes.data ?? []);
      setClosure(closureRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando el día");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch-on-param-change pattern
    void loadDay(date);
  }, [date, loadDay]);

  const totals = useMemo(() => {
    const byMethod: Record<string, number> = {};
    let ingresos = 0;
    let egresos = 0;
    for (const t of transactions) {
      const method = t.payment_method?.name ?? "Sin especificar";
      const signed = t.type === "ingreso" ? Number(t.amount) : -Number(t.amount);
      byMethod[method] = (byMethod[method] ?? 0) + signed;
      if (t.type === "ingreso") ingresos += Number(t.amount);
      else egresos += Number(t.amount);
    }
    return { byMethod, ingresos, egresos, balance: ingresos - egresos };
  }, [transactions]);

  function resetForm() {
    setType("ingreso");
    setAmount("");
    setPaymentMethodId(paymentMethods[0]?.id ?? "");
    setCategory("");
    setDescription("");
    setClientId("");
    setClientQuery("");
    setClientDropdownOpen(false);
    setShowNewClientForm(false);
    resetNewClientForm();
    setServiceId("");
    setPerformedBy("");
    setItems([]);
  }

  function addItemRow() {
    setItems((prev) => [...prev, { product_id: products[0]?.id ?? "", quantity: 1 }]);
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "ingreso" && !performedBy) {
      setError("Selecciona quién realizó el procedimiento.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: Number(amount),
          payment_method_id: paymentMethodId || null,
          category: category || null,
          description: description || null,
          client_id: clientId || null,
          client_name: clientId ? null : clientQuery.trim() || null,
          service_id: serviceId || null,
          performed_by: type === "ingreso" ? performedBy || null : null,
          transaction_date: date,
          items: consumesInventory
            ? items.filter((it) => it.product_id && it.quantity > 0)
            : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo registrar el movimiento");
      resetForm();
      setShowForm(false);
      await loadDay(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este movimiento? Esto también revierte el inventario si aplica.")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "No se pudo eliminar");
      return;
    }
    loadDay(date);
  }

  async function handleClosureAction(action: "open" | "close" | "reopen") {
    const res = await fetch("/api/closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, action }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "No se pudo actualizar el cuadre");
      return;
    }
    setClosure(json.data);
  }

  const isClosed = closure?.status === "cerrado";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cuadre diario</h1>
          <p className="text-sm text-muted">Ingresos, egresos y medios de pago del día.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          {isClosed ? (
            <Badge tone="danger" className="gap-1">
              <Lock size={12} /> Cerrado
            </Badge>
          ) : (
            <Badge tone="success" className="gap-1">
              <Unlock size={12} /> Abierto
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Ingresos</CardTitle>
          <p className="mt-2 text-xl font-semibold text-success">{formatCOP(totals.ingresos)}</p>
        </Card>
        <Card>
          <CardTitle>Egresos</CardTitle>
          <p className="mt-2 text-xl font-semibold text-accent">{formatCOP(totals.egresos)}</p>
        </Card>
        <Card>
          <CardTitle>Balance</CardTitle>
          <p className="mt-2 text-xl font-semibold">{formatCOP(totals.balance)}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Totales por medio de pago</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">{pm.name}</p>
              <p className="mt-1 text-sm font-semibold">{formatCOP(totals.byMethod[pm.name] ?? 0)}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {!isClosed && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} />
            {showForm ? "Cancelar" : "Registrar movimiento"}
          </Button>
        )}
        {!closure && (
          <Button variant="secondary" onClick={() => handleClosureAction("open")}>
            Abrir cuadre del día
          </Button>
        )}
        {closure && !isClosed && (
          <Button variant="danger" onClick={() => handleClosureAction("close")}>
            <Lock size={16} /> Cerrar cuadre del día
          </Button>
        )}
        {isClosed && (
          <Button variant="secondary" onClick={() => handleClosureAction("reopen")}>
            <Unlock size={16} /> Reabrir día
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && !isClosed && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <Select value={type} onChange={(e) => setType(e.target.value as "ingreso" | "egreso")}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </Select>
              </div>
              <div>
                <Label>Monto (COP)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Medio de pago</Label>
                <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej. Perforación, Insumos, Arriendo…"
                />
              </div>
              {type === "ingreso" && (
                <div>
                  <Label>Servicio (opcional)</Label>
                  <Select
                    value={serviceId}
                    onChange={(e) => {
                      const newServiceId = e.target.value;
                      setServiceId(newServiceId);
                      const service = services.find((s) => s.id === newServiceId);
                      // Autocompleta el monto con el precio base del servicio; el usuario aún puede editarlo.
                      if (service) setAmount(String(service.base_price));
                    }}
                  >
                    <option value="">Ninguno</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {type === "ingreso" && (
                <div>
                  <Label>Responsable del procedimiento</Label>
                  <Select required value={performedBy} onChange={(e) => setPerformedBy(e.target.value)}>
                    <option value="">Selecciona quién lo realizó…</option>
                    {ARTISTS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="relative">
                <Label>Cliente (opcional)</Label>
                <div className="relative">
                  <Input
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setClientId("");
                      setClientDropdownOpen(true);
                    }}
                    onFocus={() => setClientDropdownOpen(true)}
                    onBlur={() => {
                      // Delay closing so a click on a dropdown option registers first.
                      clientBlurTimeout.current = setTimeout(() => setClientDropdownOpen(false), 150);
                    }}
                    placeholder="Buscar o escribir nombre del cliente"
                  />
                  {clientId && (
                    <Check size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-success" />
                  )}
                </div>
                {clientDropdownOpen && (filteredClients.length > 0 || (clientQuery.trim() && !exactClientMatch)) && (
                  <div
                    className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
                    onMouseDown={(e) => {
                      // Prevent the input's onBlur from firing before the click is handled.
                      e.preventDefault();
                      if (clientBlurTimeout.current) clearTimeout(clientBlurTimeout.current);
                    }}
                  >
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectClient(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <span>{c.name}</span>
                        {c.phone && <span className="text-xs text-muted">{c.phone}</span>}
                      </button>
                    ))}
                    {clientQuery.trim() && !exactClientMatch && (
                      <button
                        type="button"
                        onClick={openNewClientForm}
                        className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-surface-2"
                      >
                        <UserPlus size={14} />
                        {`Agregar “${clientQuery.trim()}” como cliente nuevo`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showNewClientForm && (
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Nuevo cliente: <span className="text-accent">{clientQuery.trim()}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClientForm(false);
                      resetNewClientForm();
                    }}
                    className="text-muted hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="300 000 0000"
                    />
                  </div>
                  <div>
                    <Label>Fecha de cumpleaños</Label>
                    <Input
                      type="date"
                      value={newClientBirthday}
                      onChange={(e) => setNewClientBirthday(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Correo</Label>
                    <Input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div>
                    <Label>Instagram</Label>
                    <Input
                      value={newClientInstagram}
                      onChange={(e) => setNewClientInstagram(e.target.value)}
                      placeholder="@usuario"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" disabled={creatingClient} onClick={submitNewClient}>
                    {creatingClient ? "Guardando…" : "Guardar cliente"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowNewClientForm(false);
                      resetNewClientForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Todos estos campos son opcionales, solo el nombre es obligatorio.
                </p>
              </div>
            )}

            <div>
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles adicionales…"
              />
            </div>

            {consumesInventory && (
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Productos que se descuentan del inventario</p>
                  <Button type="button" size="sm" variant="secondary" onClick={addItemRow}>
                    <Plus size={14} /> Agregar producto
                  </Button>
                </div>
                {items.length === 0 && (
                  <p className="text-xs text-muted">
                    Selecciona los productos del inventario que se consumieron (ej. joya, aguja) para descontarlos automáticamente.
                  </p>
                )}
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Select
                          value={item.product_id}
                          onChange={(e) => updateItem(idx, { product_id: e.target.value })}
                          className="flex-1"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (stock: {p.stock_quantity})
                            </option>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          max={product?.stock_quantity ?? undefined}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-20"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 text-muted hover:text-accent"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar movimiento"}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Movimientos del día</CardTitle>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : transactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Medio</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Servicio</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Productos</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <Badge tone={t.type === "ingreso" ? "success" : "danger"}>{t.type}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-medium">{formatCOP(t.amount)}</td>
                    <td className="py-2 pr-3 text-muted">{t.payment_method?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{t.category ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{t.client?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{t.service?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{t.performed_by ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">
                      {t.items.length > 0
                        ? t.items.map((it) => `${it.product?.name} ×${it.quantity}`).join(", ")
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {!isClosed && (
                        <button onClick={() => handleDelete(t.id)} className="text-muted hover:text-accent">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
