import type { Pedido } from "./types";

// Ventana de tiempo dentro de la cual dos pedidos cancelados del mismo
// cliente, plataforma, monto e item se consideran un probable "reintento"
// de compra (doble click / retry de checkout) en vez de una coincidencia.
const VENTANA_REINTENTO_MS = 15 * 60 * 1000; // 15 minutos

function primerItemKey(pedido: Pedido): string {
  const item = pedido.items?.[0];
  if (!item) return "";
  return (item.sku || item.title || "").toLowerCase().trim();
}

/**
 * Detecta pedidos que probablemente corresponden a un reintento de compra
 * del mismo cliente en la plataforma (Mercado Libre / Falabella emiten un
 * id_plataforma nuevo cada vez que el comprador reintenta el checkout tras
 * un fallo o doble click). Root cause confirmado: esto ocurre del lado de
 * la plataforma, antes de que el pedido llegue a nuestro pipeline -- ambos
 * pedidos son reales y NO deben fusionarse, ocultarse ni eliminarse. Esta
 * funcion es puramente informativa: solo calcula, sobre los pedidos ya
 * cargados en el cliente, cuales podrian estar "explicados" por este
 * fenomeno para poder marcarlos visualmente en la UI.
 *
 * Heuristica (100% client-side, sin llamadas nuevas a la API):
 * misma plataforma + mismo cliente + mismo total_pagado + mismo primer
 * item (sku o titulo) + ambos con estado "cancelled" + fecha_pedido dentro
 * de una ventana de 15 minutos entre si.
 */
export function detectarPosiblesReintentos(pedidos: Pedido[]): Set<string> {
  const ids = new Set<string>();
  const cancelados = pedidos.filter(
    (p) => p.estado === "cancelled" && p.fecha_pedido && p.cliente_nombre
  );

  for (let i = 0; i < cancelados.length; i++) {
    for (let j = i + 1; j < cancelados.length; j++) {
      const a = cancelados[i];
      const b = cancelados[j];
      if (a.id === b.id) continue;
      if (a.plataforma !== b.plataforma) continue;
      if (a.cliente_nombre !== b.cliente_nombre) continue;
      if (a.total_pagado !== b.total_pagado) continue;

      const keyA = primerItemKey(a);
      const keyB = primerItemKey(b);
      if (keyA === "" || keyA !== keyB) continue;

      const ta = new Date(a.fecha_pedido!).getTime();
      const tb = new Date(b.fecha_pedido!).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb)) continue;
      if (Math.abs(ta - tb) > VENTANA_REINTENTO_MS) continue;

      ids.add(a.id);
      ids.add(b.id);
    }
  }

  return ids;
}
