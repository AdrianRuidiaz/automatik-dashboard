"use client";

// Tarea: replica, dentro de Automatik, de lo que Falabella y Mercado Libre ya
// muestran en sus propios paneles de vendedor -- "pedidos para enviar hoy" y
// "proximos pedidos" -- pero consolidando ambas plataformas en un solo lugar
// para que admin/vendedor no tengan que revisar cada panel por separado. El
// empacador ya tenia esta misma agrupacion (ver "urgentes"/"normales" en
// home-client.tsx); este componente la reutiliza como seccion de solo
// lectura para los otros roles, con el mismo umbral de urgencia (vence en
// menos de 24h) para que el criterio de "hoy" sea identico en toda la app.

import Link from "next/link";
import { AlertTriangle, CalendarClock, FileText, PackageCheck } from "lucide-react";
import { cn, formatCLP } from "@/lib/utils";
import { ESTADO_LABELS, ESTADO_COLORS, type Pedido } from "@/lib/types";
import { EstadoVacio } from "@/components/ui/estado-vacio";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

function vencePronto(p: Pedido, ahora: number): boolean {
  if (!p.fecha_limite_despacho) return false;
  return (new Date(p.fecha_limite_despacho).getTime() - ahora) / 36e5 < 24;
}

// Mismo espiritu que "ahora" en home-client.tsx: se recibe como parametro
// (derivado de lastUpdate, no de Date.now() en el render) para no violar la
// regla de pureza del compilador de React ni recalcular en cada tick.
function textoVencimiento(fecha: string | null, ahora: number): string {
  if (!fecha) return "Sin fecha limite";
  const horas = (new Date(fecha).getTime() - ahora) / 36e5;
  if (horas < 0) return "Vencido";
  if (horas < 24) {
    const d = new Date(fecha);
    return "Hoy " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }
  const dias = Math.round(horas / 24);
  return dias === 1 ? "Mañana" : `En ${dias} dias`;
}

function Fila({ p, ahora }: { p: Pedido; ahora: number }) {
  const urgente = vencePronto(p, ahora);
  return (
    <Link
      href={`/pedidos?ids=${p.id}`}
      className="card-premium row-hover flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-3 sm:flex-nowrap sm:px-4"
    >
      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular truncate text-sm font-semibold">{p.id_plataforma}</span>
          <span className={cn("pill shrink-0", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
            {p.plataforma === "ML" ? "ML" : "FA"}
          </span>
          <span className={cn("pill", ESTADO_COLORS[p.estado])}>{ESTADO_LABELS[p.estado]}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {p.cliente_nombre || "Sin cliente"}
        </span>
      </span>

      <span className="tabular hidden shrink-0 text-sm font-medium sm:block">{formatCLP(p.total_pagado)}</span>

      <span className={cn("pill shrink-0", urgente ? "bg-rose-50 text-rose-700" : "bg-secondary text-muted-foreground")}>
        <CalendarClock className="h-3 w-3" />
        {textoVencimiento(p.fecha_limite_despacho, ahora)}
      </span>

      {p.etiqueta_url ? (
        <a
          href={pdfUrl(p.etiqueta_url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <FileText className="h-3 w-3 text-rose-500" /> PDF
        </a>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">Sin etiqueta</span>
      )}
    </Link>
  );
}

interface PedidosPorEnviarProps {
  /** Pedidos pendientes (sin empacar, no cancelados/devueltos/sin pagar), ya ordenados por fecha_limite_despacho ascendente -- ver pendientesOrdenados en home-client.tsx. */
  pedidos: Pedido[];
  /** Timestamp de referencia para calcular "vence en X" (ver nota de purity en home-client.tsx). */
  ahora: number;
}

export function PedidosPorEnviar({ pedidos, ahora }: PedidosPorEnviarProps) {
  if (pedidos.length === 0) {
    return <EstadoVacio icon={PackageCheck} texto="No hay pedidos pendientes de despacho" />;
  }

  const hoy = pedidos.filter((p) => vencePronto(p, ahora));
  const proximos = pedidos.filter((p) => !vencePronto(p, ahora));

  return (
    <div className="space-y-6">
      {hoy.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-rose-700">Para enviar hoy ({hoy.length})</h3>
          </div>
          <div className="space-y-2">
            {hoy.map((p) => (
              <Fila key={p.id} p={p} ahora={ahora} />
            ))}
          </div>
        </section>
      )}

      {proximos.length > 0 && (
        <section>
          {hoy.length > 0 && (
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Proximos ({proximos.length})</h3>
          )}
          <div className="space-y-2">
            {proximos.map((p) => (
              <Fila key={p.id} p={p} ahora={ahora} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
