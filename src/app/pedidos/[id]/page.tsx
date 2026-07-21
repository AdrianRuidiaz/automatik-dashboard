"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Download, ExternalLink, Package, Clock, Info } from "lucide-react";
import { fetchPedido, fetchArchivos, getEtiquetaUrl } from "@/lib/api";
import { formatCLP, formatFechaLarga, cn } from "@/lib/utils";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";
import type { Pedido, Archivo } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";

export default function PedidoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [rol, setRol] = useState<"admin" | "vendedor" | "empacador">("admin");

  useEffect(() => {
    if (params.id) {
      fetchPedido(params.id as string).then(setPedido).catch(console.error);
      fetchArchivos(params.id as string).then(setArchivos).catch(console.error);
    }
  }, [params.id]);

  if (!pedido) return (
    <div>
      <Navbar rol={rol} onRolChange={setRol} nombreUsuario="Adrian" />
      <div className="mx-auto max-w-5xl px-6 py-12 text-center text-muted-foreground">Cargando pedido...</div>
    </div>
  );

  const etiqueta = archivos.find(a => a.tipo === "etiqueta");

  return (
    <div>
      <Navbar rol={rol} onRolChange={setRol} nombreUsuario="Adrian" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a pedidos
        </button>

        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-medium">Pedido {pedido.id_plataforma}</h1>
            <div className="mt-2 flex gap-2">
              <span className={cn("rounded px-2 py-0.5 text-xs", pedido.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                {pedido.plataforma === "ML" ? "Mercado Libre" : "Falabella"}
              </span>
              <span className={cn("rounded px-2 py-0.5 text-xs", ESTADO_COLORS[pedido.estado])}>
                {ESTADO_LABELS[pedido.estado]}
              </span>
            </div>
          </div>
          {pedido.etiqueta_url && (
            <a href={pedido.etiqueta_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-secondary">
              <FileText className="h-4 w-4 text-red-500" /> Descargar etiqueta
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" /> Informacion
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-xs text-muted-foreground">Cliente</span><p className="font-medium">{pedido.cliente_nombre || "—"}</p></div>
              <div><span className="text-xs text-muted-foreground">Fecha pedido</span><p>{formatFechaLarga(pedido.fecha_pedido)}</p></div>
              <div><span className="text-xs text-muted-foreground">Total pagado</span><p className="font-medium">{formatCLP(pedido.total_pagado)}</p></div>
              <div><span className="text-xs text-muted-foreground">Limite despacho</span><p className="text-amber-600">{formatFechaLarga(pedido.fecha_limite_despacho)}</p></div>
              <div><span className="text-xs text-muted-foreground">Pack ID</span><p className="font-mono text-xs">{pedido.id_plataforma}</p></div>
              <div><span className="text-xs text-muted-foreground">Order ID</span><p className="font-mono text-xs">{pedido.order_id}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-red-500" /> Etiqueta de envio
            </h3>
            {pedido.etiqueta_url ? (
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-16 items-center justify-center rounded-md border border-border bg-card">
                  <FileText className="h-8 w-8 text-red-400" />
                </div>
                <div className="space-y-2">
                  <a href={pedido.etiqueta_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-input px-3 py-1.5 text-xs hover:bg-secondary">
                    <Download className="h-3 w-3" /> Descargar
                  </a>
                  <a href={pedido.etiqueta_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-input px-3 py-1.5 text-xs hover:bg-secondary">
                    <ExternalLink className="h-3 w-3" /> Abrir en nueva pestana
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin etiqueta disponible</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-background p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4 text-primary" /> Items del pedido
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="border-b border-border pb-2 font-normal">Producto</th>
                <th className="border-b border-border pb-2 font-normal">SKU</th>
                <th className="border-b border-border pb-2 font-normal">Cant.</th>
                <th className="border-b border-border pb-2 font-normal text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {(pedido.items || []).map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2">{item.title}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{item.sku || "—"}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCLP(item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-medium">Total</td>
                <td className="pt-3 text-right font-medium">{formatCLP(pedido.total_pagado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </div>
  );
}
