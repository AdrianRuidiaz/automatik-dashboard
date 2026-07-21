"use client";

import { useState, useRef } from "react";
import { Search, Check, ArrowLeft, Upload, Loader2, AlertTriangle, Edit } from "lucide-react";
import { cn, formatCLP, formatFechaLarga } from "@/lib/utils";
import { upsertPedido } from "@/lib/api";
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

export function ManualOrderForm() {
  const [step, setStep] = useState<Step>("identify");
  const [orderNumber, setOrderNumber] = useState("");
  const [plataforma, setPlataforma] = useState<Plataforma>("ML");
  const [etiquetaFile, setEtiquetaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/lookup?order=${encodeURIComponent(orderNumber)}&platform=${plataforma}`
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

  const handleConfirm = async () => {
    if (!apiResult) return;
    setSaving(true);
    try {
      await upsertPedido({
        p_cliente_id: process.env.NEXT_PUBLIC_CLIENTE_ID!,
        p_plataforma: plataforma === "ML" ? "ML" : "Falabella",
        p_id_plataforma: orderNumber,
        p_order_id: apiResult.order_id,
        p_estado: apiResult.estado,
        p_cliente_nombre: apiResult.cliente_nombre,
        p_total_pagado: apiResult.total_pagado,
        p_fecha_pedido: apiResult.fecha_pedido,
        p_fecha_limite_despacho: apiResult.fecha_limite_despacho,
        p_etiqueta_url: null,
        p_items: apiResult.items,
      });
      setDone(true);
      setStep("confirm");
    } catch (err) {
      console.error("Error registrando pedido:", err);
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
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ej: 2850339714 o SP-84521"
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
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
              disabled={!orderNumber.trim() || loading}
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

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={() => setStep("identify")}
              className="inline-flex items-center gap-1 rounded-md border border-input px-4 py-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
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
