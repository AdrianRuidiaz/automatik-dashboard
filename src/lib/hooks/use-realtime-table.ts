"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

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
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `cliente_id=eq.${clienteId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => onChange(), debounceMs);
        }
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, clienteId, onChange, channelName, debounceMs]);
}
