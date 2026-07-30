"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Download, FileText, ChevronDown, ChevronRight, Package, Info, Camera, CalendarDays, Filter, X, Ban, Loader2 } from "lucide-react";
import { cn, formatCLP, formatFechaCorta, formatFechaLarga } from "@/lib/utils";
import { fetchArchivos, cancelarPedido } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Pedido, Plataforma, EstadoPedido, Archivo } from "@/lib/types";
import { EstadoBadge } from "@/components/pedidos/estado-badge";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

interface OrdersTableProps { pedidos: Pedido[]; }

function OrderDetail({ pedido }: { pedido: Pedido }) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  // Tarea: cancelar un pedido NUNCA lo elimina, solo cambia su estado a
  // "cancelled". La lista se refresca sola por la suscripción realtime que
  // ya existe en app/pedidos/page.tsx, así que no hace falta un callback
  // adicional aquí.
  const handleCancelar = async () => {
    if (pedido.estado === "cancelled") return;
    const confirmado = window.confirm(
      `¿Cancelar el pedido ${pedido.id_plataforma}? El pedido no se eliminará, solo cambiará su estado a Cancelado.`
    );
    if (!confirmado) return;
    setCancelando(true);
    try {
      await cancelarPedido(pedido.id);
    } catch (err) {
      console.error("No se pudo cancelar el pedido:", err);
      window.alert("No se pudo cancelar el pedido. Intenta nuevamente.");
    } finally {
      setCancelando(false);
    }
  };

  useEffect(() => {
    fetchArchivos(pedido.id).then(setArchivos).catch(console.error).finally(() => setLoading(false));
  }, [pedido.id]);

  const evidencias = archivos.filter(a => a.tipo === "evidencia_empaque");
  const documentos = archivos.filter(a => a.tipo === "boleta" || a.tipo === "factura" || a.tipo === "nota_credito");

  const getPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
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
            <button
              onClick={handleCancelar}
              disabled={cancelando}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {cancelando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Cancelar pedido
            </button>
          )}

          <div className="mt-4">
            <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Package className="h-3 w-3" /> Items
            </h4>
            {(pedido.items || []).length > 0 ? (
              <div className="space-y-1">
                {pedido.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <span className="flex-1"><span className="mr-1 rounded bg-background px-1.5 py-0.5 text-[10px] border border-border">x{item.quantity}</span>{item.title}</span>
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
          {loading ? <p className="text-xs text-muted-foreground">Cargando...</p> : evidencias.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {evidencias.map((ev) => (
                <a key={ev.id} href={getPublicUrl("evidencias", ev.url)} target="_blank" rel="noopener noreferrer"
                  className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-secondary">
                  <img src={getPublicUrl("evidencias", ev.url)} alt={ev.nombre_archivo ?? "Evidencia"}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </a>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Sin evidencias</p>}
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3 w-3" /> Documentos tributarios
          </h4>
          {loading ? <p className="text-xs text-muted-foreground">Cargando...</p> : documentos.length > 0 ? (
            <div className="space-y-2">
              {documentos.map((doc) => (
                <a key={doc.id} href={getPublicUrl("documentos", doc.url)} target="_blank" rel="noopener noreferrer"
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
    </div>
  );
}

const ESTADOS_FILTER: { key: "all" | EstadoPedido; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "not_paid", label: "Sin pagar" },
  { key: "pending", label: "Pendiente" },
  { key: "paid", label: "Pagado" },
  { key: "ready_to_ship", label: "Listo" },
  { key: "shipped", label: "Enviado" },
  { key: "delivered", label: "Entregado" },
  { key: "cancelled", label: "Cancelado" },
  { key: "returned", label: "Devuelto" },
];

export function OrdersTable({ pedidos }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | Plataforma>("all");
  const [estadoFilter, setEstadoFilter] = useState<"all" | EstadoPedido>("all");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeFilterCount = [
    platformFilter !== "all",
    estadoFilter !== "all",
    fechaDesde !== "",
    fechaHasta !== "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPlatformFilter("all");
    setEstadoFilter("all");
    setFechaDesde("");
    setFechaHasta("");
  };

  const filtered = useMemo(() => {
    let data = pedidos;
    // Tarea: manejo de pedidos cancelados. "Todos" en el filtro de estado
    // significa "todos los pedidos activos": los cancelados nunca se
    // mezclan por defecto, solo aparecen cuando se elige explícitamente
    // el filtro "Cancelado".
    if (estadoFilter === "all") {
      data = data.filter((p) => p.estado !== "cancelled");
    } else {
      data = data.filter((p) => p.estado === estadoFilter);
    }
    if (platformFilter !== "all") data = data.filter((p) => p.plataforma === platformFilter);
    if (fechaDesde) {
      const desde = new Date(fechaDesde);
      desde.setHours(0, 0, 0, 0);
      data = data.filter((p) => p.fecha_pedido && new Date(p.fecha_pedido) >= desde);
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      data = data.filter((p) => p.fecha_pedido && new Date(p.fecha_pedido) <= hasta);
    }
    return data;
  }, [pedidos, platformFilter, estadoFilter, fechaDesde, fechaHasta]);

  const columns: ColumnDef<Pedido>[] = useMemo(() => [
    {
      id: "expand", header: "", size: 32,
      cell: ({ row }) => (
        <button className="text-muted-foreground hover:text-foreground p-1" onClick={(e) => { e.stopPropagation(); toggleRow(row.original.id); }}>
          {expandedRows.has(row.original.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
    },
    {
      accessorKey: "id_plataforma",
      header: ({ column }) => (<button className="flex items-center gap-1 font-normal" onClick={() => column.toggleSorting()}>N° pedido <ArrowUpDown className="h-3 w-3" /></button>),
      cell: ({ row }) => <span className="font-medium text-xs md:text-sm">{row.original.id_plataforma}</span>,
    },
    {
      accessorKey: "plataforma", header: "Plat.",
      cell: ({ row }) => <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] md:text-[11px]", row.original.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>{row.original.plataforma === "ML" ? "ML" : "FA"}</span>,
    },
    {
      accessorKey: "fecha_pedido",
      header: ({ column }) => (<button className="hidden md:flex items-center gap-1 font-normal" onClick={() => column.toggleSorting()}>Fecha <ArrowUpDown className="h-3 w-3" /></button>),
      cell: ({ row }) => <span className="hidden md:block text-sm">{formatFechaCorta(row.original.fecha_pedido)}</span>,
    },
    {
      accessorKey: "cliente_nombre", header: "Cliente",
      cell: ({ row }) => <span className="block max-w-[120px] md:max-w-[180px] truncate text-sm">{row.original.cliente_nombre ?? "—"}</span>,
    },
    {
      id: "items_preview", header: "Items",
      cell: ({ row }) => {
        const t = (row.original.items ?? []).map(i => i.title).join(", ");
        return <span className="hidden lg:block max-w-[160px] truncate text-xs text-muted-foreground">{t || "—"}</span>;
      },
    },
    {
      accessorKey: "total_pagado",
      header: ({ column }) => (<button className="flex items-center gap-1 font-normal" onClick={() => column.toggleSorting()}>Total <ArrowUpDown className="h-3 w-3" /></button>),
      cell: ({ row }) => <span className="text-sm whitespace-nowrap">{formatCLP(row.original.total_pagado)}</span>,
    },
    {
      accessorKey: "estado", header: "Estado",
      cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
    },
    {
      id: "etiqueta", header: "PDF",
      cell: ({ row }) => row.original.etiqueta_url ? (
        <button className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
          onClick={(e) => { e.stopPropagation(); window.open(pdfUrl(row.original.etiqueta_url!), "_blank"); }}>
          <FileText className="h-3.5 w-3.5 text-red-500" />
          <span className="hidden md:inline">PDF</span>
        </button>
      ) : <span className="text-xs text-muted-foreground">-</span>,
    },
  ], [expandedRows]);

  const table = useReactTable({
    data: filtered, columns, state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium">Pedidos</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} pedidos</span>
      </div>

      {/* Barra principal: busqueda + toggle filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5 flex-1 min-w-0 max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input placeholder="Buscar pedido, cliente..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
            showFilters || activeFilterCount > 0 ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
        {estadoFilter !== "cancelled" && (
          <button onClick={() => setEstadoFilter("cancelled")}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Ver cancelados
          </button>
        )}
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
        <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
          <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exportar</span>
        </button>
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
          {/* Plataforma */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Plataforma</p>
            <div className="flex gap-1 flex-wrap">
              {(["all", "ML", "Falabella"] as const).map((opt) => (
                <button key={opt} onClick={() => setPlatformFilter(opt)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors", platformFilter === opt ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>
                  {opt === "all" ? "Todas" : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Estado</p>
            <div className="flex gap-1 flex-wrap">
              {ESTADOS_FILTER.map((ef) => (
                <button key={ef.key} onClick={() => setEstadoFilter(ef.key)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors", estadoFilter === ef.key ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>
                  {ef.label}
                </button>
              ))}
            </div>
            {estadoFilter === "all" && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                &quot;Todos&quot; no incluye pedidos cancelados. Selecciona &quot;Cancelado&quot; para verlos.
              </p>
            )}
          </div>

          {/* Rango de fechas */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Rango de fechas
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-primary" />
              </div>
              {(fechaDesde || fechaHasta) && (
                <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  Limpiar fechas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabla responsive */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="min-w-[640px] px-4 md:px-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="border-b border-border px-2 py-2 text-left text-xs font-normal text-muted-foreground whitespace-nowrap">
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <>
                  <tr key={row.id} className="cursor-pointer border-b border-border hover:bg-secondary/50 transition-colors"
                    onClick={() => toggleRow(row.original.id)}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expandedRows.has(row.original.id) && (
                    <tr key={row.id + "-d"}>
                      <td colSpan={columns.length} className="border-b border-border p-0">
                        <OrderDetail pedido={row.original} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {table.getRowModel().rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No hay pedidos con esos filtros</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">
          {filtered.length > 0
            ? `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} de ${filtered.length}`
            : "0 resultados"
          }
        </span>
        <div className="flex gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Anterior</button>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Siguiente</button>
        </div>
      </div>
    </div>
  );
}
