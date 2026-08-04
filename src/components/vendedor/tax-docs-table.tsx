"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileCheck, AlertCircle, Upload, Eye, Loader2, ChevronRight, ChevronDown,
  Package, Info, Camera, FileText, Search, History, Ban,
} from "lucide-react";
import { cn, formatCLP, formatFechaCorta, formatFechaLarga } from "@/lib/utils";
import { uploadArchivo, registrarArchivo, fetchArchivos } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  esDocumentoTributario,
  TIPOS_DOCUMENTO_TRIBUTARIO,
  type Pedido,
  type Archivo,
  type TipoDocumentoTributario,
} from "@/lib/types";
import { EstadoBadge } from "@/components/pedidos/estado-badge";
import { FiltroPills } from "@/components/pedidos/filtro-pills";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

interface TaxDocsTableProps { pedidos: Pedido[]; }

const DOC_LABELS: Record<TipoDocumentoTributario, { label: string; className: string }> = {
  boleta: { label: "Boleta", className: "bg-indigo-50 text-indigo-700" },
  factura: { label: "Factura", className: "bg-emerald-50 text-emerald-700" },
  nota_credito: { label: "Nota de credito", className: "bg-amber-50 text-amber-700" },
};

function DetalleVendedor({ pedido, docs }: { pedido: Pedido; docs: Archivo[] }) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetchArchivos(pedido.id).then(setArchivos).catch(console.error).finally(() => setCargando(false));
  }, [pedido.id]);

  const evidencias = archivos.filter((a) => a.tipo === "evidencia_empaque");
  const publicUrl = (bucket: string, path: string) =>
    supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  return (
    <div className="animate-in-soft border-t border-border bg-secondary/30 px-4 py-4 sm:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <p className="eyebrow mb-2.5 flex items-center gap-1.5"><Info className="h-3 w-3" /> Informacion</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd className="truncate font-medium">{pedido.cliente_nombre || "Sin cliente"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Fecha</dt><dd>{formatFechaLarga(pedido.fecha_pedido)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="tabular font-semibold">{formatCLP(pedido.total_pagado)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Estado</dt><dd><EstadoBadge estado={pedido.estado} /></dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">N&deg; pedido</dt><dd className="tabular font-mono text-xs">{pedido.id_plataforma}</dd></div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Última actualización de estado</dt>
              <dd className="text-xs">{formatFechaLarga(pedido.updated_at)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="eyebrow mb-2.5 flex items-center gap-1.5"><Package className="h-3 w-3" /> Items</p>
          {(pedido.items ?? []).length > 0 ? (
            <ul className="space-y-1.5">
              {pedido.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex-1">
                    <span className="mr-1.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">x{item.quantity}</span>
                    {item.title}
                  </span>
                  <span className="tabular shrink-0 text-muted-foreground">{formatCLP(item.unit_price)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Total</span><span className="tabular">{formatCLP(pedido.total_pagado)}</span>
              </li>
            </ul>
          ) : <p className="text-xs text-muted-foreground">Sin items registrados</p>}
        </div>

        <div className="space-y-4">
          <div>
            <p className="eyebrow mb-2.5 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Documentos tributarios</p>
            {docs.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {docs.map((doc) => (
                  <a key={doc.id} href={publicUrl("documentos", doc.url)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <span className="capitalize">{doc.tipo.replace("_", " ")}</span>
                  </a>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">Aun sin documento</p>}
          </div>

          <div>
            <p className="eyebrow mb-2.5 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Etiqueta</p>
            {pedido.etiqueta_url ? (
              <a href={pdfUrl(pedido.etiqueta_url)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40">
                <FileText className="h-4 w-4 text-rose-500" /> Ver PDF
              </a>
            ) : <p className="text-xs text-muted-foreground">Sin etiqueta</p>}
          </div>

          <div>
            <p className="eyebrow mb-2.5 flex items-center gap-1.5"><Camera className="h-3 w-3" /> Evidencias</p>
            {cargando ? <p className="text-xs text-muted-foreground">Cargando...</p>
              : evidencias.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {evidencias.map((ev) => (
                    <a key={ev.id} href={publicUrl("evidencias", ev.url)} target="_blank" rel="noopener noreferrer"
                      className="h-14 w-14 overflow-hidden rounded-lg border border-border">
                      <img src={publicUrl("evidencias", ev.url)} alt="Evidencia" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Sin evidencias</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

type VistaTab = "activos" | "cancelados";

const DOC_FILTROS: { key: "all" | "sin" | TipoDocumentoTributario; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "sin", label: "Sin documento" },
  { key: "boleta", label: "Boleta" },
  { key: "factura", label: "Factura" },
  { key: "nota_credito", label: "N. credito" },
];

export function TaxDocsTable({ pedidos }: TaxDocsTableProps) {
  // Tarea: manejo de pedidos cancelados — nunca se eliminan y no se mezclan
  // visualmente con los activos por defecto. Se navegan en una pestaña aparte.
  const [tab, setTab] = useState<VistaTab>("activos");
  const [filter, setFilter] = useState<"all" | "sin" | TipoDocumentoTributario>("all");
  const [busqueda, setBusqueda] = useState("");
  const [docs, setDocs] = useState<Record<string, Archivo[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoDocumentoTributario>("boleta");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pendienteRef = useRef<Pedido | null>(null);

  const toggle = (id: string) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      const entries = await Promise.all(
        pedidos.slice(0, 60).map(async (p) => {
          try {
            const arch = await fetchArchivos(p.id);
            return [p.id, arch.filter((a) => esDocumentoTributario(a.tipo))] as const;
          } catch { return [p.id, [] as Archivo[]] as const; }
        })
      );
      if (!cancel) setDocs(Object.fromEntries(entries));
    })();
    return () => { cancel = true; };
  }, [pedidos]);

  const handleFile = async (file: File) => {
    const pedido = pendienteRef.current;
    if (!pedido) return;
    setUploading(pedido.id);
    try {
      const path = `${pedido.id_plataforma}/${tipoSel}_${Date.now()}_${file.name}`;
      const url = await uploadArchivo("documentos", path, file);
      await registrarArchivo({
        pedido_id: pedido.id, tipo: tipoSel, url, nombre_archivo: file.name,
      });
      const arch = await fetchArchivos(pedido.id);
      setDocs((prev) => ({ ...prev, [pedido.id]: arch.filter((a) => esDocumentoTributario(a.tipo)) }));
      setActivo(null);
    } catch (e) { console.error(e); }
    finally { setUploading(null); pendienteRef.current = null; if (fileRef.current) fileRef.current.value = ""; }
  };

  const pedidosDeLaPestana = pedidos.filter((p) =>
    tab === "cancelados" ? p.estado === "cancelled" : p.estado !== "cancelled"
  );

  const visibles = pedidosDeLaPestana.filter((p) => {
    const d = docs[p.id] ?? [];
    const q = busqueda.trim().toLowerCase();
    if (q && !(p.id_plataforma.toLowerCase().includes(q) || (p.cliente_nombre || "").toLowerCase().includes(q))) return false;
    if (filter === "all") return true;
    if (filter === "sin") return d.length === 0;
    return d.some((doc) => doc.tipo === filter);
  });

  const cantidadCancelados = pedidos.filter((p) => p.estado === "cancelled").length;

  return (
    <div>
      {/* Pestañas: activos vs cancelados (nunca mezclados) */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setTab("activos")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
            tab === "activos" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pedidos activos
        </button>
        <button
          onClick={() => setTab("cancelados")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5",
            tab === "cancelados" ? "bg-red-500/10 text-red-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Ban className="h-3.5 w-3.5" /> Cancelados
          {cantidadCancelados > 0 && (
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-[10px] font-bold text-red-500">
              {cantidadCancelados}
            </span>
          )}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 max-w-xs flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar pedido o cliente..."
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{visibles.length} pedidos</span>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Documento tributario</p>
        <FiltroPills options={DOC_FILTROS} value={filter} onChange={setFilter} />
      </div>

      <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      <div className="space-y-2">
        {visibles.map((p) => {
          const docsPedido = docs[p.id] ?? [];
          const tiposFaltantes = TIPOS_DOCUMENTO_TRIBUTARIO.filter(
            (t) => !docsPedido.some((d) => d.tipo === t)
          );
          const abierto = abiertos.has(p.id);
          return (
            <div key={p.id} className={cn("card-premium overflow-hidden", abierto && "ring-1 ring-primary/15", p.estado === "cancelled" && "opacity-80")}>
              <button onClick={() => toggle(p.id)}
                className="row-hover flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-secondary/40 sm:px-4">
                <span className="shrink-0 text-muted-foreground">
                  {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular truncate text-sm font-semibold">{p.id_plataforma}</span>
                    <span className={cn("pill shrink-0", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                      {p.plataforma === "ML" ? "ML" : "FA"}
                    </span>
                    <EstadoBadge estado={p.estado} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {p.cliente_nombre || "Sin cliente"} &middot; {formatFechaCorta(p.fecha_pedido)}
                    <span className="mx-1">&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <History className="h-2.5 w-2.5" /> act. {formatFechaCorta(p.updated_at)}
                    </span>
                  </span>
                </span>

                <span className="tabular hidden shrink-0 text-sm font-medium sm:block">{formatCLP(p.total_pagado)}</span>

                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {docsPedido.length > 0 ? (
                    docsPedido.map((d) => (
                      <span key={d.id} className={cn("pill", DOC_LABELS[d.tipo as TipoDocumentoTributario]?.className)}>
                        <FileCheck className="h-3 w-3" />
                        <span className="hidden sm:inline">{DOC_LABELS[d.tipo as TipoDocumentoTributario]?.label}</span>
                      </span>
                    ))
                  ) : (
                    <span className="pill bg-secondary text-muted-foreground">
                      <AlertCircle className="h-3 w-3" />
                      <span className="hidden sm:inline">Sin documento</span>
                    </span>
                  )}
                </span>
              </button>

              {abierto && (
                <>
                  <DetalleVendedor pedido={p} docs={docsPedido} />
                  {tab === "activos" && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3">
                      {docsPedido.map((d) => (
                        <a key={d.id} href={supabase.storage.from("documentos").getPublicUrl(d.url).data.publicUrl}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40">
                          <Eye className="h-3.5 w-3.5" /> Ver {DOC_LABELS[d.tipo as TipoDocumentoTributario]?.label.toLowerCase()}
                        </a>
                      ))}

                      {tiposFaltantes.length > 0 && (
                        activo === p.id ? (
                          <>
                            <select value={tipoSel} onChange={(e) => setTipoSel(e.target.value as TipoDocumentoTributario)}
                              className="rounded-lg border border-input bg-card px-2.5 py-2 text-xs">
                              {tiposFaltantes.map((t) => (
                                <option key={t} value={t}>{DOC_LABELS[t].label}</option>
                              ))}
                            </select>
                            <button onClick={() => { pendienteRef.current = p; fileRef.current?.click(); }}
                              disabled={uploading === p.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
                              {uploading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              Elegir archivo
                            </button>
                            <button onClick={() => setActivo(null)} className="px-2 text-xs text-muted-foreground">Cancelar</button>
                          </>
                        ) : (
                          <button onClick={() => { setActivo(p.id); setTipoSel(tiposFaltantes[0]); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                            <Upload className="h-3.5 w-3.5" />
                            {docsPedido.length > 0 ? "Agregar documento (ej. nota de credito)" : "Subir documento tributario"}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {visibles.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {tab === "cancelados" ? "No hay pedidos cancelados con ese filtro" : "No hay pedidos con ese filtro"}
        </p>
      )}
    </div>
  );
}
