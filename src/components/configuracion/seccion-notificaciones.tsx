"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  pushSoportado,
  obtenerSuscripcionActual,
  activarNotificaciones,
  desactivarNotificaciones,
  obtenerPreferenciasPush,
  actualizarPreferenciasPush,
  type PreferenciasPush,
} from "@/lib/push";

export function SeccionNotificaciones() {
  const [capaz, setCapaz] = useState(false);
  const [estado, setEstado] = useState<"off" | "on" | "loading">("off");
  const [prefs, setPrefs] = useState<PreferenciasPush>({ pedidoNuevo: true, urgente: true });
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    // pushSoportado() consulta APIs del navegador (Notification/ServiceWorker)
    // que no existen en SSR; va en el mismo efecto que ya suscribe la
    // comprobacion async de abajo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
