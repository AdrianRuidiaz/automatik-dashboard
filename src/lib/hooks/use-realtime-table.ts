"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Tarea: extraer el patron de suscripcion Realtime repetido en app/page.tsx,
// app/pedidos/page.tsx y app/productos/page.tsx (canal + postgres_changes
// filtrado por cliente_id + debounce 800ms + cleanup). Los 3 sitios eran
// identicos salvo por el nombre de tabla, el nombre de canal y la funcion
// de recarga -- por eso el hook los recibe como parametros en vez de
// asumirlos, para no forzar a los 3 call-sites a converger en un unico
// nombre de canal/tabla.
//
// IMPORTANTE (filtro por cliente_id): sin el filtro, un cambio en filas de
// CUALQUIER cliente (incluye sync periodico de n8n) recarga la pagina para
// TODOS los usuarios conectados, sin importar a que cliente pertenecen --
// se sentia como carga lenta o que la pagina "nunca termina", sobre todo en
// redes moviles. Por eso `clienteId` es obligatorio: mientras sea null/undefined
// (aun no resuelto por role-context) el hook no se suscribe.
//
// IMPORTANTE (debounce): procesos por lotes (ej. migracion de etiquetas, o
// el sync de productos de n8n cada 15 min) pueden actualizar muchas filas
// seguidas en pocos segundos -- cada UPDATE dispara el callback y sin
// proteccion se hacen N recargas completas en cadena. Se agrupan con un
// debounce: solo se recarga una vez, `debounceMs` (default 800) despues del
// ultimo cambio detectado.
//
// IMPORTANTE (reconexion + refresh-on-focus, "100% en vivo"): antes
// .subscribe() se llamaba sin callback de estado -- si el websocket se
// caia (laptop suspendida, wifi cortado, pestana mucho tiempo en
// background), el canal quedaba muerto para siempre sin reintentar, y nada
// se enteraba. Dos capas de proteccion, independientes entre si:
//   1. Reconexion: el callback de .subscribe(status) detecta CLOSED /
//      CHANNEL_ERROR / TIMED_OUT y vuelve a crear + suscribir el canal, con
//      backoff exponencial simple (2s, 4s, 8s, ... tope en
//      RECONNECT_MAX_DELAY_MS) y un limite de intentos para no loopear
//      infinito si el problema es de fondo (Supabase caido, etc). El
//      contador de intentos se resetea apenas se logra un SUBSCRIBED.
//   2. Refresh-on-focus: es la red de seguridad MAS importante, porque
//      cubre el caso en que la reconexion de arriba tambien falle por
//      cualquier motivo. Al volver a la pestana (visibilitychange a
//      "visible", o evento focus de window) se dispara el mismo
//      scheduleChange() debounced que ya usan los postgres_changes -- osea
//      el usuario nunca ve datos viejos al volver a mirar la pantalla,
//      incluso si el realtime quedo mudo.
const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 8;

export interface UseRealtimeTableOptions {
  /** Tabla de Supabase a escuchar (ej. "pedidos", "productos"). */
  table: string;
  /** cliente_id por el que filtrar. Si es null/undefined, no se suscribe. */
  clienteId: string | null | undefined;
  /** Se llama (debounced) cuando hay un cambio en la tabla para este cliente. */
  onChange: () => void;
  /**
   * Nombre del canal de Supabase Realtime. Cada call-site usa uno propio
   * (ej. "pedidos-realtime" en el dashboard vs. "pedidos-table-rt" en
   * /pedidos, ambos sobre la misma tabla) -- se mantiene explicito aca en
   * vez de derivarlo de `table` para no cambiar el nombre real del canal
   * que ya esta en uso.
   */
  channelName: string;
  /** Debounce en ms antes de llamar a onChange. Default 800 (igual en los 3 usos originales). */
  debounceMs?: number;
}

export function useRealtimeTable({
  table,
  clienteId,
  onChange,
  channelName,
  debounceMs = 800,
}: UseRealtimeTableOptions): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!clienteId) return;

    let unmounted = false;
    let channel: RealtimeChannel | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const scheduleChange = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(), debounceMs);
    };

    const subscribe = () => {
      if (unmounted) return;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `cliente_id=eq.${clienteId}` },
          () => scheduleChange()
        )
        .subscribe((status) => {
          if (unmounted) return;
          if (status === "SUBSCRIBED") {
            // Conexion sana: resetea el contador de reintentos.
            attempts = 0;
            return;
          }
          if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (attempts >= RECONNECT_MAX_ATTEMPTS) return;
            const delay = Math.min(
              RECONNECT_BASE_DELAY_MS * 2 ** attempts,
              RECONNECT_MAX_DELAY_MS
            );
            attempts += 1;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
              if (unmounted) return;
              if (channel) supabase.removeChannel(channel);
              subscribe();
            }, delay);
          }
        });
    };

    subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleChange();
    };
    const handleFocus = () => scheduleChange();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      unmounted = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, clienteId, onChange, channelName, debounceMs]);
}
