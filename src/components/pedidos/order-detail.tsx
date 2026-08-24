"use client";

import { useState, useEffect } from "react";
import { Ban, Camera, FileText, Info, Loader2, Package } from "lucide-react";
import { formatCLP, formatFechaLarga } from "@/lib/utils";
import { fetchArchivos, cancelarPedido } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { pdfUrl } from "@/lib/pdf";
import type { Pedido, Archivo } from "@/lib/types";
import { EvidenciaGaleria } from "@/components/pedidos/evidencia-galeria";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function OrderDetail({ pedido }: { pedido: Pedido }) {
  const { usuario } = useRole();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tarea: cancelar un pedido NUNCA lo elimina, solo cambia su estado a
  // "cancelled". La lista se refresca sola por la suscripción realtime que
  // ya existe en app/pedidos/page.tsx, así que no hace falta un callback
  // adicional aquí.
  //
  // El confirm/alert nativos del navegador se reemplazaron por un modal
  // propio (ConfirmDialog) y un mensaje inline: los dialogos nativos se ven
  // identicos sin importar el diseño de la app y rompen la estetica.
  const handleCancelarClick = () => {
    if (pedido.estado === "cancelled") return;
    setErrorMsg(null);
    setConfirmOpen(true);
  };

  const confirmarCancelar = async () => {
    setCancelando(true);
    try {
      await cancelarPedido(pedido.id, usuario?.rolId ?? null);
      setConfirmOpen(false);
    } catch (err) {
      console.error("No se pudo cancelar el pedido:", err);
      setErrorMsg("No se pudo cancelar el pedido. Intenta nuevamente.");
    } finally {
      setCancelando(false);
    }
  };

  useEffect(() => {
    fetchArchivos(pedido.id).then(setArchivos).catch(console.error).finally(() => setLoading(false));
  }, [pedido.id]);

  const evidencias = archivos.filter(a => a.tipo === "evidencia_empaque");
  const documentos = archivos.filter(a => a.tipo === "boleta" || a.tipo === "factura" || a.tipo === "nota_credito");

  // Tarea: admin (y vendedor, en DetalleVendedor) puede eliminar/reemplazar
  // evidencias que subio el empacador -- ver EvidenciaGaleria. Al eliminar
  // o reemplazar una, se actualiza el estado local reemplazando solo las
  // evidencias (los documentos tributarios de `archivos` quedan intactos).
  const handleEvidenciasChange = (nuevasEvidencias: Archivo[]) => {
    setArchivos((prev) => [...prev.filter((a) => a.tipo !== "evidencia_empaque"), ...nuevasEvidencias]);
  };

  return (
    <div className="bg-secondary/30 px-3 py-4 md:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Info className="h-3 w-3" /> Informacion
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium truncate">{pedido.cliente_nombre || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Fecha</p><p>{formatFechaLarga(pedido.fecha_pedido)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="font-medium">{formatCLP(pedido.total_pagado)}</p></div>
            <div><p className="text-xs text-muted-foreground">Limite despacho</p><p className="text-amber-600 text-xs">{formatFechaLarga(pedido.fecha_limite_despacho)}</p></div>
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Pack ID</p><p className="font-mono text-xs break-all">{pedido.id_plataforma}</p></div>
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Última actualización de estado</p><p className="text-xs">{formatFechaLarga(pedido.updated_at)}</p></div>
          </div>

          {pedido.estado !== "cancelled" && (
            <div className="mt-3">
              <button
                onClick={handleCancelarClick}
                disabled={cancelando}
                className="btn-premium inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {cancelando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                Cancelar pedido
              </button>
              {errorMsg && <p className="mt-1.5 text-xs text-red-600">{errorMsg}</p>}
            </div>
          )}

          {/* Tarea: trazabilidad de cancelacion. cancelado_por_usuario viene
              embebido desde fetchPedidos (join con usuarios_roles); si un
              pedido fue cancelado antes de que existiera esta columna,
              simplemente no se muestra nada aca. */}
          {pedido.estado === "cancelled" && pedido.cancelado_por_usuario && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ban className="h-3.5 w-3.5 shrink-0 text-red-500" />
              Cancelado por <span className="font-medium text-foreground">{pedido.cancelado_por_usuario.nombre}</span>
              {pedido.cancelado_en && <> el {formatFechaLarga(pedido.cancelado_en)}</>}
            </p>
          )}

          {/* Tarea (2026-08-24): motivo real de cancelacion entregado por la
              plataforma de origen (ML manda cancel_detail; Falabella no
              expone motivo en su API, asi que para pedidos FA este bloque
              simplemente no aparece). Es independiente del bloque de arriba:
              una cancelacion detectada por el sync automatico de n8n no
              tiene cancelado_por_usuario (nadie del equipo la disparo desde
              aca) pero si puede traer motivo_cancelacion. */}
          {pedido.estado === "cancelled" && pedido.motivo_cancelacion && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Motivo: <span className="text-foreground">{pedido.motivo_cancelacion}</span>
            </p>
          )}

          <div className="mt-4">
            <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Package className="h-3 w-3" /> Items
            </h4>
            {(pedido.items || []).length > 0 ? (
              <div className="space-y-2">
                {pedido.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div>
                        <span className="mr-1 rounded bg-background px-1.5 py-0.5 text-[10px] border border-border">x{item.quantity}</span>
                        {item.title}
                      </div>
                      {item.sku && (
                        <span className="mt-1 inline-block rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                          SKU: {item.sku}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">{formatCLP(item.unit_price)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-1 text-xs font-medium mt-2">
                  <span>Total</span><span>{formatCLP(pedido.total_pagado)}</span>
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground">Sin items registrados</p>}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3 w-3" /> Etiqueta de envio
          </h4>
          {pedido.etiqueta_url ? (
            <div className="flex flex-col gap-2">
              <a href={pdfUrl(pedido.etiqueta_url!)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-background transition-colors">
                <FileText className="h-4 w-4 text-red-500 shrink-0" /> Descargar PDF
              </a>
            </div>
          ) : <p className="text-xs text-muted-foreground">Sin etiqueta disponible</p>}

          <h4 className="mt-4 mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Camera className="h-3 w-3" /> Evidencias de empaque
          </h4>
          {loading ? (
            <div className="flex gap-2">
              <div className="skeleton h-16 w-16 rounded-lg" />
              <div className="skeleton h-16 w-16 rounded-lg" />
            </div>
          ) : (
            // Tarea: admin puede eliminar/reemplazar las evidencias que subio
            // el empacador (editable=true). OrdersTable/OrderDetail solo se
            // renderiza para rol === "admin" (ver app/pedidos/page.tsx), asi
            // que no hace falta ningun chequeo de rol adicional aca.
            <EvidenciaGaleria
              evidencias={evidencias}
              idPlataforma={pedido.id_plataforma}
              editable
              onChange={handleEvidenciasChange}
            />
          )}
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3 w-3" /> Documentos tributarios
          </h4>
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          ) : documentos.length > 0 ? (
            <div className="space-y-2">
              {documentos.map((doc) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs hover:bg-secondary transition-colors">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{doc.tipo.replace("_", " ")}</p>
                    <p className="text-muted-foreground truncate">{doc.nombre_archivo}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Sin documentos tributarios</p>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancelar pedido"
        description="Este pedido va a quedar marcado como cancelado. No se elimina y se puede seguir viendo en la pestaña de cancelados."
        confirmLabel="Cancelar pedido"
        danger
        loading={cancelando}
        onConfirm={confirmarCancelar}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
