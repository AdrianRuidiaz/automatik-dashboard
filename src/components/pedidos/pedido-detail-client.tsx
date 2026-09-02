"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Package, Info } from "lucide-react";
import { fetchPedido } from "@/lib/api";
import { formatCLP, formatFechaLarga, cn } from "@/lib/utils";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";
import type { Pedido } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table";
import { PdfLink } from "@/components/pedidos/pdf-link";

interface PedidoDetailClientProps {
  /**
   * Pedido ya resuelto en el servidor (ver app/pedidos/[id]/page.tsx, ahora
   * un Server Component) -- adelanto optimista del mismo fetchPedido(id) que
   * antes solo corria en el navegador. cargarPedido() de mas abajo sigue
   * corriendo siempre al montar (y en cada evento de useRealtimeTable), asi
   * que este seed nunca puede quedar desactualizado por mas tiempo del que
   * ya tardaba ese mismo primer fetch. Si es null (pedido no resuelto en el
   * servidor, sesion no disponible en esa request, o cualquier error) el
   * componente arranca exactamente como antes de este cambio: skeleton de
   * carga hasta que termine el fetch del cliente.
   */
  initialPedido: Pedido | null;
}

export default function PedidoDetailClient({ initialPedido }: PedidoDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(initialPedido);
  const [cargando, setCargando] = useState(!initialPedido);

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

  // Fix (boton "Volver" no responde entrando desde una notificacion push):
  // cuando esta pagina se abre como la primera (y unica) entrada de la
  // pestaña -- el service worker abre un link de notificacion con
  // clients.openWindow() en una ventana nueva si la app no estaba ya abierta
  // (ver public/sw.js), y lo mismo pasa con un bookmark o un link
  // compartido -- no existe ninguna entrada previa en el historial del
  // navegador. router.back() delega en history.back(), que sin una entrada
  // anterior simplemente no hace nada (sin error, sin aviso): el boton se
  // sentia "roto". window.history.length <= 1 identifica ese caso (nada
  // antes de esta pagina dentro de esta pestaña); ahi se manda a la lista de
  // pedidos en vez de intentar volver a un historial que no existe.
  const handleVolver = () => {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push("/pedidos");
    } else {
      router.back();
    }
  };

  return (
    <div>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <button onClick={handleVolver}
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
              </div>
              {pedido.etiqueta_url ? (
                <PdfLink url={pedido.etiqueta_url} nombreCliente={pedido.cliente_nombre} numeroPedido={pedido.id_plataforma}
                  className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-60">
                  <FileText className="h-4 w-4 text-rose-500" /> Ver etiqueta
                </PdfLink>
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
