"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, FileText, Package, Info } from "lucide-react";
import { fetchPedido } from "@/lib/api";
import { formatCLP, formatFechaLarga, cn } from "@/lib/utils";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";
import type { Pedido } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

export default function PedidoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPedido = useCallback(() => {
    if (!params.id) return;
    fetchPedido(params.id as string)
      .then(setPedido)
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [params.id]);

  useEffect(() => {
    cargarPedido();
  }, [cargarPedido]);

  // Tarea: "100% en vivo". Esta vista de detalle no tenia NINGUN mecanismo
  // de actualizacion -- cargaba una vez al montar y nunca mas, a diferencia
  // del dashboard/pedidos/productos que ya usan useRealtimeTable. Se
  // suscribe al mismo hook compartido, filtrado por cliente_id (unico
  // filtro que soporta el hook, pensado originalmente para listas). Como
  // esta vista muestra UN solo pedido, onChange no recarga una lista: vuelve
  // a pedir este mismo pedido (cargarPedido, que ya conoce su id por la URL)
  // para traer su estado actualizado. clienteId sale de pedido.cliente_id --
  // mientras el pedido no haya cargado la primera vez el hook no se
  // suscribe, igual que en las otras 3 vistas antes de resolver el
  // cliente_id. Con esto la vista se beneficia de reconexion con backoff y
  // de refresh-on-focus (visibilitychange/focus) igual que las demas.
  useRealtimeTable({
    table: "pedidos",
    clienteId: pedido?.cliente_id,
    onChange: cargarPedido,
    channelName: "pedido-detalle-rt",
  });

  return (
    <div>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <button onClick={() => router.back()}
          className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        {cargando ? (
          <div className="space-y-4">
            <div className="h-9 w-64 animate-pulse rounded-lg bg-secondary" />
            <div className="h-40 animate-pulse rounded-xl bg-secondary" />
          </div>
        ) : !pedido ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No se encontro el pedido</p>
        ) : (
          <div className="animate-in-soft space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Pedido</p>
                <h1 className="display tabular mt-1 text-2xl sm:text-3xl">{pedido.id_plataforma}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cn("pill", pedido.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                    {pedido.plataforma === "ML" ? "Mercado Libre" : "Falabella"}
                  </span>
                  <span className={cn("pill", ESTADO_COLORS[pedido.estado])}>{ESTADO_LABELS[pedido.estado]}</span>
                </div>
                {/* Tarea (2026-08-24): esta pagina es el destino directo del
                    link "url" que manda el push de "pedido cancelado" -- antes
                    no mostraba absolutamente nada sobre la cancelacion, asi que
                    quien tocaba la notificacion llegaba aca sin ver el motivo
                    que ya vio en el texto del push. motivo_cancelacion viene
                    null para Falabella (su API no lo entrega) y para pedidos
                    cancelados antes de que existiera esta columna -- en esos
                    casos simplemente no se muestra la segunda linea. */}
                {pedido.estado === "cancelled" && (pedido.motivo_cancelacion || pedido.cancelado_por_usuario) && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    <p>
                      {pedido.cancelado_por_usuario && (
                        <>
                          Cancelado por <span className="font-medium text-foreground">{pedido.cancelado_por_usuario.nombre}</span>
                          {pedido.cancelado_en && <> el {formatFechaLarga(pedido.cancelado_en)}</>}
                          {pedido.motivo_cancelacion && ". "}
                        </>
                      )}
                      {pedido.motivo_cancelacion && (
                        <>Motivo: <span className="text-foreground">{pedido.motivo_cancelacion}</span></>
                      )}
                    </p>
                  </div>
                )}
              </div>
              {pedido.etiqueta_url ? (
                <a href={pdfUrl(pedido.etiqueta_url)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40">
                  <FileText className="h-4 w-4 text-rose-500" /> Descargar etiqueta
                </a>
              ) : (
                <span className="rounded-lg border border-dashed border-input px-4 py-2.5 text-xs text-muted-foreground">
                  Sin etiqueta disponible
                </span>
              )}
            </div>

            <section className="card-premium p-5">
              <p className="eyebrow mb-3 flex items-center gap-1.5"><Info className="h-3 w-3" /> Informacion</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd className="mt-0.5 font-medium">{pedido.cliente_nombre || "Sin cliente"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Fecha pedido</dt><dd className="mt-0.5">{formatFechaLarga(pedido.fecha_pedido)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Total pagado</dt><dd className="tabular mt-0.5 font-semibold">{formatCLP(pedido.total_pagado)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Limite despacho</dt><dd className="mt-0.5 text-amber-600">{formatFechaLarga(pedido.fecha_limite_despacho)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Order ID</dt><dd className="tabular mt-0.5 font-mono text-xs">{pedido.order_id}</dd></div>
              </dl>
            </section>

            <section className="card-premium overflow-hidden">
              <p className="eyebrow flex items-center gap-1.5 border-b border-border bg-secondary/40 px-5 py-3">
                <Package className="h-3 w-3" /> Items del pedido
              </p>
              {(pedido.items ?? []).length > 0 ? (
                <table className="w-full text-sm">
                  <tbody>
                    {pedido.items.map((item, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">{item.title}</td>
                        <td className="px-2 py-3 font-mono text-xs text-muted-foreground">{item.sku || "-"}</td>
                        <td className="px-2 py-3 text-center text-muted-foreground">x{item.quantity}</td>
                        <td className="tabular px-5 py-3 text-right">{formatCLP(item.unit_price)}</td>
                      </tr>
                    ))}
                    <tr className="bg-secondary/40">
                      <td colSpan={3} className="px-5 py-3 text-right font-medium">Total</td>
                      <td className="tabular px-5 py-3 text-right font-semibold">{formatCLP(pedido.total_pagado)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">Sin items registrados</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
