"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
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

// Extraido de la antigua pagina standalone /admin/usuarios para poder
// mostrarse dentro de Configuracion > Equipo (que es donde vive el link
// real ahora -- se saco del navbar para agrupar todo lo administrativo en
// un solo lugar). La ruta /admin/usuarios se deja viva y usa este mismo
// componente, por si alguien tiene el link guardado.
export function EquipoManager() {
  const { clienteId, clienteNombre, esSuperAdmin, usuario } = useRole();
  const [usuarios, setUsuarios] = useState<UsuarioRol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [idEnProceso, setIdEnProceso] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolUsuario>("vendedor");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!clienteId) return;
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("usuarios_roles")
        .select("id, nombre, email, rol, activo, created_at, auth_user_id")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUsuarios((data as UsuarioRol[]) || []);
    } catch (err) {
      console.error("No se pudo cargar el equipo:", err);
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo cargar el equipo",
      });
    } finally {
      setCargando(false);
    }
  }, [clienteId]);

  // Fetch de datos al montar/cuando cambia clienteId, mismo patron que app/page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setConfirmandoId(null);
    setIdEnProceso(u.id); setMensaje(null);
    try {
      const res = await fetch("/api/admin/usuario", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: u.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar al usuario");
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error inesperado" });
    } finally {
      setIdEnProceso(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Equipo</p>
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
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin usuarios aún</td></tr>
            ) : usuarios.map((u) => {
              const esUnoMismo = u.auth_user_id !== null && u.auth_user_id === usuario?.id;
              const gestionable = !esUnoMismo && u.rol !== "super_admin";
              const procesando = idEnProceso === u.id;
              return (
                <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">{u.nombre}{esUnoMismo && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    {gestionable ? (
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
                    {!gestionable ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : procesando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : confirmandoId === u.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">¿Eliminar para siempre?</span>
                        <button
                          onClick={() => handleEliminar(u)}
                          className="rounded-lg border border-red-400/40 px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/10"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          onClick={() => setConfirmandoId(null)}
                          className="rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoId(u.id)}
                        title="Eliminar del equipo"
                        className="flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-400/40 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
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
  );
}
