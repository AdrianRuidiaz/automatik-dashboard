"use client";

import { useEffect, useState } from "react";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, formatFechaLarga, parseUserAgent } from "@/lib/utils";

type SesionActiva = {
  id: string;
  creada_en: string;
  actualizada_en: string;
  user_agent: string | null;
  ip: string | null;
  es_actual: boolean;
};

// Tarea: "Seguridad" en Configuracion, version con lista real de
// dispositivos. auth.sessions no es legible desde el cliente sin pasar por
// una funcion SECURITY DEFINER (ver migracion rpc_listar_y_cerrar_sesiones
// en Supabase) -- ahi es donde vive el filtro a auth.uid() y la
// identificacion de "esta sesion" via el claim session_id del JWT.
// cerrar_mi_sesion() borra la fila de auth.sessions, lo mismo que hace
// GoTrue en su propio signOut (auth.refresh_tokens tiene FK ON DELETE
// CASCADE hacia sessions), asi que revoca los refresh tokens de ese
// dispositivo -- no puede seguir renovando su access token una vez que
// venza. No hay forma de invalidar un access token JWT ya emitido antes de
// que expire por si solo; es una limitacion del formato, no de esta
// implementacion.
export function SeccionSeguridad() {
  const [email, setEmail] = useState<string | null>(null);
  const [sesiones, setSesiones] = useState<SesionActiva[] | null>(null);
  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  const [cerrandoTodas, setCerrandoTodas] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarSesiones = async () => {
    const { data, error } = await supabase.rpc("listar_mis_sesiones");
    if (!error) setSesiones((data as SesionActiva[] | null) ?? []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    cargarSesiones();
  }, []);

  const cerrarSesion = async (id: string) => {
    setMensaje(null);
    setCerrandoId(id);
    const { error } = await supabase.rpc("cerrar_mi_sesion", { p_session_id: id });
    setCerrandoId(null);
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo cerrar esa sesión" });
      return;
    }
    setSesiones((prev) => prev?.filter((s) => s.id !== id) ?? null);
    setMensaje({ tipo: "ok", texto: "Sesión cerrada" });
  };

  const cerrarTodasLasDemas = async () => {
    setMensaje(null);
    setCerrandoTodas(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setCerrandoTodas(false);
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo cerrar las otras sesiones" });
      return;
    }
    setMensaje({ tipo: "ok", texto: "Se cerró la sesión en todos los demás dispositivos" });
    cargarSesiones();
  };

  const hayOtras = (sesiones ?? []).some((s) => !s.es_actual);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-3">Esta sesión</p>
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Cuenta</p>
          <p>{email ?? "—"}</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="eyebrow">Dispositivos con sesión activa</p>
          {hayOtras && (
            <button
              onClick={cerrarTodasLasDemas}
              disabled={cerrandoTodas}
              className="flex shrink-0 items-center gap-1.5 text-xs text-red-400/80 transition-colors hover:text-red-400 disabled:opacity-60"
            >
              {cerrandoTodas && <Loader2 className="h-3 w-3 animate-spin" />}
              Cerrar todas las demás
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Si no reconoces alguno de estos dispositivos, cierra su sesión desde acá.
        </p>

        {sesiones === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : sesiones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron sesiones activas.</p>
        ) : (
          <div className="space-y-2">
            {sesiones.map((s) => {
              const { dispositivo, navegador } = parseUserAgent(s.user_agent);
              const Icon = dispositivo.startsWith("Celular") ? Smartphone : Monitor;
              const ip = s.ip ? s.ip.split("/")[0] : null;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
                    s.es_actual ? "border-amber-400/20 bg-amber-400/5" : "border-input"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span>{dispositivo}</span>
                        {navegador && <span className="text-muted-foreground">· {navegador}</span>}
                        {s.es_actual && (
                          <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                            Este dispositivo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ip ? `${ip} · ` : ""}
                        Última actividad: {formatFechaLarga(s.actualizada_en)}
                      </p>
                    </div>
                  </div>
                  {!s.es_actual && (
                    <button
                      onClick={() => cerrarSesion(s.id)}
                      disabled={cerrandoId === s.id}
                      className="btn-premium flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-red-400/40 hover:text-red-400 disabled:opacity-60 sm:self-auto"
                    >
                      {cerrandoId === s.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      Cerrar sesión
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mensaje && (
          <p className={cn("mt-3 text-xs", mensaje.tipo === "ok" ? "text-emerald-400" : "text-red-500")}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}
