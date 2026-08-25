"use client";

import { useState, useRef } from "react";
import { Search, Check, ArrowLeft, Upload, Loader2, AlertTriangle, Edit } from "lucide-react";
import { cn, formatCLP, formatFechaLarga } from "@/lib/utils";
import {
  crearPedidoManual,
  existePedidoDuplicado,
  verificarPdfDisponible,
  uploadArchivo,
  registrarArchivo,
} from "@/lib/api";
import { useRole } from "@/lib/role-context";
import type { Plataforma, PedidoItem } from "@/lib/types";

type Step = "identify" | "verify" | "confirm";

interface ApiResult {
  cliente_nombre: string | null;
  total_pagado: number;
  fecha_pedido: string | null;
  fecha_limite_despacho: string | null;
  estado: string;
  items: PedidoItem[];
  order_id: string;
}

// Los webhooks de n8n ("Order Lookup API", "Verificar y Obtener Etiqueta
// PDF") esperan el string "FA" para Falabella, mientras que el resto del
// sistema (columna pedidos.plataforma, este mismo componente) usa
// "Falabella". Este mapeo existe solo para las llamadas a esos dos
// webhooks -- todo lo demás sigue usando el valor de Plataforma tal cual.
function platformParam(p: Plataforma): string {
  return p === "ML" ? "ML" : "FA";
}

export function ManualOrderForm() {
  const { clienteId } = useRole();
  const [step, setStep] = useState<Step>("identify");
  const [orderNumber, setOrderNumber] = useState("");
  const [plataforma, setPlataforma] = useState<Plataforma>("ML");
  const [etiquetaFile, setEtiquetaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState(false);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tarea: validación de pedidos duplicados (creación manual).
  // Se chequea ANTES de llamar a la API externa de la plataforma: si el
  // número de pedido ya existe en el sistema, bloqueamos aquí mismo, sin
  // gastar una consulta a Mercado Libre/Falabella y sin perder lo que el
  // vendedor ya escribió en el formulario.
  const handleSearch = async () => {
    if (!orderNumber.trim() || !clienteId) return;
    setLoading(true);
    setError(null);
    setDuplicado(false);
    try {
      const existente = await existePedidoDuplicado(orderNumber.trim(), clienteId);
      if (existente) {
        setDuplicado(true);
        setError("Este pedido ya existe en el sistema.");
        return;
      }

      const res = await fetch(
        `/api/orders/lookup?order=${encodeURIComponent(orderNumber)}&platform=${platformParam(plataforma)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se encontró el pedido");
      }
      const data: ApiResult = await res.json();
      setApiResult(data);
      setStep("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  // Tarea: asegurar que quede una guía de despacho asociada antes de
  // guardar. Si el vendedor ya adjuntó el PDF manualmente (paso
  // "Identificar" -- por ejemplo porque el pedido ya fue despachado y la
  // API de ML/Falabella ya no permite regenerar la guía), se usa ese
  // archivo directamente y NO se llama a la verificación automática: pedirle
  // a la API una guía que el vendedor ya tiene en la mano no tiene sentido y
  // antes bloqueaba el registro sin motivo. Solo si NO adjuntó nada se
  // intenta traer la guía automáticamente desde la plataforma. En cualquier
  // caso, si no queda una guía disponible se aborta ANTES de tocar
  // Supabase/Airtable: no queda ningún registro a medias y el vendedor ya
  // fue bloqueado antes por duplicados (existePedidoDuplicado), así que
  // puede reintentar sin riesgo de duplicar el pedido.
  const handleConfirm = async () => {
    if (!apiResult || !clienteId) return;
    setSaving(true);
    setError(null);
    try {
      let etiquetaUrl: string | null = null;

      if (etiquetaFile) {
        etiquetaUrl = await uploadArchivo(
          "etiquetas",
          `${orderNumber}/etiqueta_${Date.now()}.pdf`,
          etiquetaFile
        );
      } else {
        const verificacion = await verificarPdfDisponible(orderNumber, platformParam(plataforma));
        if (!verificacion.existe) {
          setError(
            verificacion.mensaje ||
              "No se encontró la guía de despacho de este pedido. Adjúntala manualmente arriba o genérala en la plataforma antes de registrar el pedido."
          );
          return;
        }
        etiquetaUrl = verificacion.url ?? null;
      }

      const resultado = await crearPedidoManual({
        cliente_id: clienteId,
        plataforma: plataforma === "ML" ? "ML" : "Falabella",
        id_plataforma: orderNumber,
        order_id: apiResult.order_id,
        estado: apiResult.estado,
        cliente_nombre: apiResult.cliente_nombre,
        total_pagado: apiResult.total_pagado,
        fecha_pedido: apiResult.fecha_pedido,
        fecha_limite_despacho: apiResult.fecha_limite_despacho,
        etiqueta_url: etiquetaUrl,
        items: apiResult.items,
      });

      if (etiquetaUrl) {
        try {
          await registrarArchivo({
            pedido_id: resultado.pedido_id,
            tipo: "etiqueta",
            url: etiquetaUrl,
            nombre_archivo: etiquetaFile?.name ?? null,
          });
        } catch (err) {
          // El pedido ya quedó registrado correctamente; si falla solo el
          // registro del archivo lo dejamos en el log en vez de bloquear
          // al vendedor con un error confuso en este punto.
          console.error("No se pudo registrar el archivo de etiqueta:", err);
        }
      }

      setDone(true);
      setStep("confirm");
    } catch (err) {
      console.error("Error registrando pedido:", err);
      setError("No se pudo registrar el pedido. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("identify");
    setOrderNumber("");
    setApiResult(null);
    setEtiquetaFile(null);
    setError(null);
    setDuplicado(false);
    setDone(false);
  };

  const steps = [
    { key: "identify", label: "Identificar" },
    { key: "verify", label: "Verificar datos" },
    { key: "confirm", label: "Confirmar" },
  ];

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <h3 className="mb-5 flex items-center gap-2 text-base font-medium">
        <Search className="h-5 w-5 text-primary" />
        Ingresar pedido manual
      </h3>

      <div className="mb-6 flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <div className="mx-2 h-px w-10 bg-border" />}
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-content-center rounded-full text-xs font-medium",
                step === s.key
                  ? "bg-primary text-white"
                  : steps.findIndex((x) => x.key === step) > i
                  ? "bg-green-600 text-white"
                  : "border border-input text-muted-foreground"
              )}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {steps.findIndex((x) => x.key === step) > i ? (
                <Check className="h-3 w-3" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                step === s.key ? "font-medium" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {step === "identify" && (
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">N° de pedido</label>
              <input
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  if (duplicado) {
                    setDuplicado(false);
                    setError(null);
                  }
                }}
                placeholder="Ej: 2850339714 o SP-84521"
                className={cn(
                  "rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring",
                  duplicado
                    ? "border-red-500 focus:ring-red-500"
                    : "border-input"
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Plataforma</label>
              <select
                value={plataforma}
                onChange={(e) => setPlataforma(e.target.value as Plataforma)}
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="ML">Mercado Libre</option>
                <option value="Falabella">Falabella</option>
              </select>
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Etiqueta de envío (opcional)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-md border border-dashed border-input bg-card p-4 text-center hover:border-primary"
            >
              {etiquetaFile ? (
                <span className="text-sm text-green-600">{etiquetaFile.name}</span>
              ) : (
                <>
                  <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Arrastra un PDF o haz click
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setEtiquetaFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Si no adjuntas la etiqueta aquí, al confirmar se verificará automáticamente que ya exista la guía de despacho en Mercado Libre/Falabella. Si el pedido ya fue despachado y la plataforma ya no permite regenerarla, adjúntala tú mismo aquí.
            </p>
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSearch}
              disabled={!orderNumber.trim() || loading || !clienteId}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> Buscar en API
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === "verify" && apiResult && (
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 text-xs font-medium">Datos ingresados</div>
              <div className="rounded-md bg-card p-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">N° pedido</span>
                  <span className="font-mono font-medium">{orderNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Plataforma</span>
                  <span className={cn("rounded px-2 py-0.5 text-[11px]",
                    plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark"
                  )}>
                    {plataforma === "ML" ? "Mercado Libre" : "Falabella"}
                  </span>
                </div>
                {etiquetaFile && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Etiqueta</span>
                    <span className="text-xs text-green-600">{etiquetaFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Datos de la API</span>
                <button className="flex items-center gap-1 text-xs text-primary">
                  <Edit className="h-3 w-3" /> Editar
                </button>
              </div>
              <div className="rounded-md bg-card p-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{apiResult.cliente_nombre ?? "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{formatFechaLarga(apiResult.fecha_pedido)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{formatCLP(apiResult.total_pagado)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Estado</span>
                  <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-800">
                    {apiResult.estado}
                  </span>
                </div>
                {apiResult.items.length > 0 && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="mb-1 text-xs text-muted-foreground">Items</div>
                    {apiResult.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-xs">
                        <span>
                          <span className="mr-1 rounded bg-secondary px-1 py-0.5 text-[10px]">
                            x{item.quantity}
                          </span>
                          {item.title}
                        </span>
                        <span>{formatCLP(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={() => { setStep("identify"); setError(null); }}
              className="inline-flex items-center gap-1 rounded-md border border-input px-4 py-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !clienteId}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirmar y registrar
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && done && (
        <div className="text-center py-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <p className="mb-1 text-sm font-medium">Pedido registrado</p>
          <p className="mb-4 text-xs text-muted-foreground">
            {orderNumber} fue ingresado correctamente en el sistema
          </p>
          <button
            onClick={reset}
            className="rounded-md border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
          >
            Ingresar otro pedido
          </button>
        </div>
      )}
    </div>
  );
}
