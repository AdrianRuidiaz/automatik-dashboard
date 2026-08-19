"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Building2, Loader2 } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { fetchPerfilEmpresa, actualizarPerfilEmpresa, uploadArchivo, type PerfilEmpresa } from "@/lib/api";

// Tarea: "Empresa" en Configuracion. public.clientes solo se puede escribir
// via el RPC actualizar_perfil_empresa (ver src/lib/api.ts) -- la RLS de la
// tabla en si solo deja UPDATE a super_admin, asi que un admin de tenant no
// podria hacer .update() directo aunque quisiera. rut/direccion/telefono no
// son columnas propias, viven dentro de clientes.config (jsonb) para no
// requerir otra migracion si mas adelante se agregan mas campos.
export function SeccionEmpresa() {
  const { clienteId } = useRole();
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    fetchPerfilEmpresa(clienteId)
      .then((p) => {
        if (!p) return;
        setPerfil(p);
        setNombre(p.nombre);
        setRut(p.rut);
        setDireccion(p.direccion);
        setTelefono(p.telefono);
        setLogoUrl(p.logo_url);
      })
      .catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar el perfil de la empresa" }))
      .finally(() => setCargando(false));
  }, [clienteId]);

  const handleLogo = async (file: File) => {
    if (!clienteId) return;
    setMensaje(null);
    setSubiendoLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const url = await uploadArchivo("documentos", `${clienteId}/logo-${Date.now()}.${ext}`, file);
      setLogoUrl(url);
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo subir el logo" });
    } finally {
      setSubiendoLogo(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clienteId) return;
    setMensaje(null);
    setGuardando(true);
    try {
      await actualizarPerfilEmpresa({
        p_cliente_id: clienteId,
        p_nombre: nombre,
        p_logo_url: logoUrl,
        p_rut: rut,
        p_direccion: direccion,
        p_telefono: telefono,
      });
      setMensaje({ tipo: "ok", texto: "Perfil de la empresa actualizado" });
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo guardar el perfil de la empresa",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="h-32 animate-pulse rounded-lg bg-secondary" />;
  }

  if (!perfil) {
    return <p className="text-sm text-muted-foreground">No se encontró la empresa asociada a tu cuenta.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Perfil de la empresa</p>
        <p className="text-sm text-muted-foreground">
          Aparece en documentos y exportaciones a nombre de tu negocio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-input bg-secondary">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo" fill sizes="64px" className="object-cover" />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <label className="btn-premium flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40">
            {subiendoLogo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {logoUrl ? "Cambiar logo" : "Subir logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subiendoLogo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogo(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nombre de la empresa</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">RUT</label>
          <input
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="76.123.456-7"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dirección</label>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {mensaje && (
          <p className={mensaje.tipo === "ok" ? "text-xs text-emerald-400" : "text-xs text-red-500"}>
            {mensaje.texto}
          </p>
        )}

        <button
          disabled={guardando}
          type="submit"
          className="btn-premium flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
