"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { User, Bell, Palette, Loader2, Check, Shield, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/role-context";
import { useTema } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { cn, formatFechaLarga } from "@/lib/utils";
import { fetchPerfilEmpresa, actualizarPerfilEmpresa, uploadArchivo, type PerfilEmpresa } from "@/lib/api";
import {
  pushSoportado,
  obtenerSuscripcionActual,
  activarNotificaciones,
  desactivarNotificaciones,
  obtenerPreferenciasPush,
  actualizarPreferenciasPush,
  type PreferenciasPush,
} from "@/lib/push";

type Seccion = "cuenta" | "seguridad" | "notificaciones" | "apariencia" | "empresa";

export default function ConfiguracionPage() {
  const { rolReal } = useRole();
  const [seccion, setSeccion] = useState<Seccion>("cuenta");

  // "Empresa" solo tiene sentido para quien administra el tenant -- un
  // vendedor o empacador no deberia poder ver ni editar el nombre/logo/RUT
  // del negocio. La autorizacion real vive en el RPC (actualizar_perfil_empresa),
  // esto es solo para no mostrar una pestaña que igual les rebotaria.
  const puedeVerEmpresa = rolReal === "admin" || rolReal === "super_admin";

  const secciones = useMemo(() => {
    const base: { id: Seccion; label: string; icon: typeof User }[] = [
      { id: "cuenta", label: "Cuenta", icon: User },
      { id: "seguridad", label: "Seguridad", icon: Shield },
      { id: "notificaciones", label: "Notificaciones", icon: Bell },
      { id: "apariencia", label: "Apariencia", icon: Palette },
    ];
    if (puedeVerEmpresa) base.push({ id: "empresa", label: "Empresa", icon: Building2 });
    return base;
  }, [puedeVerEmpresa]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-medium">Configuración</h1>
          <p className="text-sm text-muted-foreground">Tu cuenta, notificaciones y apariencia del panel.</p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex gap-1 overflow-x-auto md:w-48 md:flex-none md:flex-col md:overflow-visible">
            {secciones.map((s) => {
              const Icon = s.icon;
              const activo = seccion === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSeccion(s.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    activo
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                      : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="card-premium flex-1 p-5 sm:p-6">
            {seccion === "cuenta" && <SeccionCuenta />}
            {seccion === "seguridad" && <SeccionSeguridad />}
            {seccion === "notificaciones" && <SeccionNotificaciones />}
            {seccion === "apariencia" && <SeccionApariencia />}
            {seccion === "empresa" && puedeVerEmpresa && <SeccionEmpresa />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SeccionCuenta() {
  const { usuario } = useRole();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    if (password.length < 8) {
      setMensaje({ tipo: "error", texto: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    if (password !== confirmar) {
      setMensaje({ tipo: "error", texto: "Las contraseñas no coinciden" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMensaje({ tipo: "ok", texto: "Contraseña actualizada" });
      setPassword("");
      setConfirmar("");
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo actualizar la contraseña",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-3">Perfil</p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nombre</p>
            <p>{usuario?.nombre ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Correo</p>
            <p>{usuario?.email ?? "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Cambiar contraseña</p>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
          <input
            required
            type="password"
            minLength={8}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Confirmar contraseña"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {mensaje && (
            <p className={mensaje.tipo === "ok" ? "text-xs text-emerald-400" : "text-xs text-red-500"}>
              {mensaje.texto}
            </p>
          )}
          <button
            disabled={loading}
            type="submit"
            className="btn-premium flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar contraseña
          </button>
        </form>
      </div>
    </div>
  );
}

// Tarea: "Seguridad" en Configuracion. Alcance honesto con lo que Supabase
// Auth realmente expone al propio usuario desde el cliente (sin service
// role): no hay una lista de "dispositivos con sesion activa" -- eso vive en
// auth.sessions, que solo la API de administracion puede leer. Lo que SI
// existe y es real: el propio `user.last_sign_in_at`, y `signOut({scope:
// "others"})`, que revoca todas las sesiones/refresh tokens del usuario
// EXCEPTO la actual, sin necesidad de saber cuantas ni donde estan. Es la
// version legitima de "cerrar sesion en otros dispositivos".
function SeccionSeguridad() {
  const [email, setEmail] = useState<string | null>(null);
  const [ultimoAcceso, setUltimoAcceso] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUltimoAcceso((data.user as { last_sign_in_at?: string } | null)?.last_sign_in_at ?? null);
    });
  }, []);

  const cerrarOtrasSesiones = async () => {
    setMensaje(null);
    setCerrando(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setCerrando(false);
    setMensaje(
      error
        ? { tipo: "error", texto: "No se pudo cerrar las otras sesiones" }
        : { tipo: "ok", texto: "Se cerró la sesión en todos los demás dispositivos" }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-3">Esta sesión</p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cuenta</p>
            <p>{email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Último inicio de sesión</p>
            <p>{ultimoAcceso ? formatFechaLarga(ultimoAcceso) : "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-1">Otros dispositivos</p>
        <p className="mb-3 text-sm text-muted-foreground">
          Si iniciaste sesión en otro computador o celular y no fuiste tú, ciérrala desde acá. Esta pestaña/dispositivo no se ve afectado.
        </p>
        <button
          onClick={cerrarOtrasSesiones}
          disabled={cerrando}
          className="btn-premium flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          {cerrando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Cerrar sesión en otros dispositivos
        </button>
        {mensaje && (
          <p className={cn("mt-2 text-xs", mensaje.tipo === "ok" ? "text-emerald-400" : "text-red-500")}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function SeccionNotificaciones() {
  const [capaz, setCapaz] = useState(false);
  const [estado, setEstado] = useState<"off" | "on" | "loading">("off");
  const [prefs, setPrefs] = useState<PreferenciasPush>({ pedidoNuevo: true, urgente: true });
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setCapaz(pushSoportado());
    obtenerSuscripcionActual()
      .then(async (sub) => {
        setEstado(sub ? "on" : "off");
        if (sub) {
          const p = await obtenerPreferenciasPush();
          if (p) setPrefs(p);
        }
      })
      .catch(() => setEstado("off"));
  }, []);

  const activar = async () => {
    setMensaje(null);
    setEstado("loading");
    const r = await activarNotificaciones();
    if (r.ok) {
      setEstado("on");
      const p = await obtenerPreferenciasPush();
      if (p) setPrefs(p);
    } else {
      setEstado("off");
      setMensaje(r.error ?? "No se pudo activar");
    }
  };

  const desactivar = async () => {
    setMensaje(null);
    setEstado("loading");
    const r = await desactivarNotificaciones();
    setEstado(r.ok ? "off" : "on");
    if (!r.ok) setMensaje(r.error ?? "No se pudo desactivar");
  };

  const cambiarPref = async (campo: keyof PreferenciasPush, valor: boolean) => {
    const anterior = prefs;
    const nuevo = { ...prefs, [campo]: valor };
    setPrefs(nuevo);
    const r = await actualizarPreferenciasPush(nuevo);
    if (!r.ok) {
      setPrefs(anterior);
      setMensaje(r.error ?? "No se pudo guardar");
    }
  };

  if (!capaz) {
    return <p className="text-sm text-muted-foreground">Este navegador no soporta notificaciones push.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Notificaciones push</p>
        <p className="text-sm text-muted-foreground">
          Avisos en este dispositivo/navegador para pedidos nuevos y urgentes.
        </p>
      </div>

      {estado !== "on" ? (
        <button
          onClick={activar}
          disabled={estado === "loading"}
          className="btn-premium flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {estado === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Activar notificaciones
        </button>
      ) : (
        <div className="max-w-sm space-y-1">
          <label className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-sm">
            <span>
              Pedido nuevo
              <span className="block text-xs text-muted-foreground">Cuando entra un pedido nuevo por ML o Falabella</span>
            </span>
            <input
              type="checkbox"
              checked={prefs.pedidoNuevo}
              onChange={(e) => cambiarPref("pedidoNuevo", e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-sm">
            <span>
              Urgente
              <span className="block text-xs text-muted-foreground">Pedidos que vencen su despacho hoy</span>
            </span>
            <input
              type="checkbox"
              checked={prefs.urgente}
              onChange={(e) => cambiarPref("urgente", e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <button
            onClick={desactivar}
            className="mt-2 rounded-lg px-3 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-red-400/10 hover:text-red-400"
          >
            Desactivar notificaciones en este dispositivo
          </button>
        </div>
      )}
      {mensaje && <p className="text-xs text-red-500">{mensaje}</p>}
    </div>
  );
}

function SeccionApariencia() {
  const { tema, setTema } = useTema();

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Tema</p>
        <p className="text-sm text-muted-foreground">Se guarda en este dispositivo/navegador.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setTema("dark")}
          className={cn(
            "w-36 rounded-xl border-2 p-3 text-left transition-colors",
            tema === "dark" ? "border-amber-400" : "border-input"
          )}
        >
          <div
            className="mb-2 h-9 w-full rounded-md border border-white/10"
            style={{ background: "linear-gradient(135deg,#14151c,#1c1d26)" }}
          />
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Oscuro {tema === "dark" && <Check className="h-3.5 w-3.5 text-amber-400" />}
          </p>
          <p className="text-xs text-muted-foreground">Dark luxury</p>
        </button>
        <button
          onClick={() => setTema("light")}
          className={cn(
            "w-36 rounded-xl border-2 p-3 text-left transition-colors",
            tema === "light" ? "border-amber-400" : "border-input"
          )}
        >
          <div
            className="mb-2 h-9 w-full rounded-md border border-black/10"
            style={{ background: "linear-gradient(135deg,#faf6ee,#f0e9d8)" }}
          />
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Claro {tema === "light" && <Check className="h-3.5 w-3.5 text-amber-400" />}
          </p>
          <p className="text-xs text-muted-foreground">Misma paleta, invertida</p>
        </button>
      </div>
    </div>
  );
}

// Tarea: "Empresa" en Configuracion. public.clientes solo se puede escribir
// via el RPC actualizar_perfil_empresa (ver src/lib/api.ts) -- la RLS de la
// tabla en si solo deja UPDATE a super_admin, asi que un admin de tenant no
// podria hacer .update() directo aunque quisiera. rut/direccion/telefono no
// son columnas propias, viven dentro de clientes.config (jsonb) para no
// requerir otra migracion si mas adelante se agregan mas campos.
function SeccionEmpresa() {
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-input bg-secondary">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
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
