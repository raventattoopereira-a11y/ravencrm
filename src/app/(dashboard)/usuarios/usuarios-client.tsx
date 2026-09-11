"use client";

import { useState } from "react";
import { Button, Card, CardTitle, Input, Label, Select, Badge } from "@/components/ui/primitives";
import type { Profile, Role } from "@/lib/types/database";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export function UsuariosClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Profile[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("empleado");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el usuario");
      setUsers((prev) => [
        ...prev,
        { id: json.data.id, email, full_name: fullName, role, active: true, created_at: new Date().toISOString() },
      ]);
      setShowForm(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("empleado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este usuario? No podrá volver a iniciar sesión.")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "No se pudo eliminar");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted">Administra quién puede entrar al CRM y con qué rol.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Nuevo usuario
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre completo</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Correo</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Contraseña temporal</Label>
              <Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="empleado">Empleado</option>
                <option value="admin">Administrador</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Equipo ({users.length})</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Correo</th>
                <th className="py-2 pr-3">Rol</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Desde</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{u.full_name || "—"}</td>
                  <td className="py-2 pr-3 text-muted">{u.email ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <Select
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="w-36"
                    >
                      <option value="empleado">Empleado</option>
                      <option value="admin">Administrador</option>
                    </Select>
                  </td>
                  <td className="py-2 pr-3">
                    <button onClick={() => handleToggleActive(u.id, !u.active)}>
                      <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Activo" : "Inactivo"}</Badge>
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-muted">{formatDate(u.created_at)}</td>
                  <td className="py-2 pr-3 text-right">
                    {u.id !== currentUserId && (
                      <button onClick={() => handleDelete(u.id)} className="text-muted hover:text-accent">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
