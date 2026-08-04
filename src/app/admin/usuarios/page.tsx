"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, UserPlus, Trash2, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";

interface UsuarioRol {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
  auth_user_id: string | null;
}

const ROLES_INVITABLES: RolUsuario[] = ["admin", "vendedor", "empacador"];

export default function UsuariosPage() {
  const { clienteId, clienteNombre, esSuperAdmin, usuario } = useRole();
  const [usuarios, setUsuarios] = useState<UsuarioRol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [idEnProceso, setIdEnProceso] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolUsuario>("vendedor");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!clienteId) return;
    setCargando(true);
    const { data } = await supabase
      .from("usuarios_roles")
      .select("id, nombre, email, rol, activo, created_at, auth_user_id")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    setUsuarios((data as UsuarioRol[]) || []);
    setCargando(false);
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) return;
    setEnviando(true); setMensaje(null);
    try {
      const res = await fetch("/api/admin/invitar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, rol, cliente_id: clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo enviar la invitación");
      setMensaje({ tipo: "ok", texto: `Invitación enviada a ${email}` });
      setNombre(""); setEmail("");
      cargar();
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error inesperado" });
    } finally {
      setEnviando(false);
    }
  };

  const handleCambiarRol = async (u: UsuarioRol, nuevoRol: string) => {
    if (nuevoRol === u.rol) return;
    setIdEnProceso(u.id); setMensaje(null);
    try {
      const res = await fetch("/api/admin/usuario", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: u.id, rol: nuevoRol }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo cambiar el rol");
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, rol: nuevoRol } : x)));
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error inesperado" });
    } finally {
      setIdEnProceso(null);
    }
  };

  const handleEliminar = async (u: UsuarioRol) => {
    if (!window.confirm(`¿Quitar a ${u.nombre} (${u.email}) del equipo? Pierde acceso al panel de inmediato.`)) return;
    setIdEnProceso(u.id); setMensaje(null);
    try {
      const res = await fetch("/api/admin/usuario", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: u.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar al usuario");
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: false } : x)));
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error inesperado" });
    } finally {
      setIdEnProceso(null);
    }
  };

  const handleReactivar = async (u: UsuarioRol) => {
    setIdEnProceso(u.id); setMensaje(null);
    try {
      const res = await fetch("/api/admin/usuario", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: u.id, activo: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo reactivar al usuario");
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: true } : x)));
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error inesperado" });
    } finally {
      setIdEnProceso(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-medium">Equipo</h1>
          <p className="text-sm text-muted-foreground">
            Invita y administra quién tiene acceso al panel
            {esSuperAdmin && clienteNombre ? <> — <span className="font-medium text-foreground">{clienteNombre}</span></> : "."}
          </p>
        </div>

        <form onSubmit={handleInvitar} className="card-premium flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Correo</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary">
              {ROLES_INVITABLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button disabled={enviando || !clienteId} type="submit"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Invitar
          </button>
        </form>

        {mensaje && (
          <p className={mensaje.tipo === "ok" ? "text-sm text-emerald-400" : "text-sm text-red-500"}>{mensaje.texto}</p>
        )}

        <div className="card-premium overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06] text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sin usuarios aún</td></tr>
              ) : usuarios.map((u) => {
                const esUnoMismo = u.auth_user_id !== null && u.auth_user_id === usuario?.id;
                const gestionable = !esUnoMismo && u.rol !== "super_admin";
                const procesando = idEnProceso === u.id;
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3">{u.nombre}{esUnoMismo && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {gestionable && u.activo ? (
                        <select
                          value={u.rol}
                          disabled={procesando}
                          onChange={(e) => handleCambiarRol(u, e.target.value)}
                          className="rounded-lg border border-input bg-card px-2 py-1 text-xs capitalize outline-none focus:border-primary disabled:opacity-60"
                        >
                          {ROLES_INVITABLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="capitalize">{u.rol.replace("_", " ")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${u.activo ? "bg-emerald-400/10 text-emerald-400" : "bg-white/[0.06] text-muted-foreground"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!gestionable ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : procesando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : u.activo ? (
                        <button
                          onClick={() => handleEliminar(u)}
                          title="Quitar del equipo"
                          className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-400/40 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivar(u)}
                          title="Reactivar acceso"
                          className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
