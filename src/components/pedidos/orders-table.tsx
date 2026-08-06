"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Download, FileText, ChevronDown, ChevronRight, Package, Info, Camera, CalendarDays, Filter, X, Ban, Loader2, PackageX, UserCheck } from "lucide-react";
import { cn, formatCLP, formatFechaCorta, formatFechaLarga } from "@/lib/utils";
import { fetchArchivos, cancelarPedido } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import { ESTADO_LABELS } from "@/lib/types";
import type { Pedido, Plataforma, EstadoPedido, Archivo } from "@/lib/types";
import { EstadoBadge } from "@/components/pedidos/estado-badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

interface OrdersTableProps { pedidos: Pedido[]; }

// Etiqueta "3x Producto (SKU: ABC)" usada tanto en las exportaciones como
// en cualquier resumen de texto plano de los items de un pedido.
function itemLabel(i: { quantity: number; title: string; sku?: string | null }) {
  return `${i.quantity}x ${i.title}${i.sku ? ` (SKU: ${i.sku})` : ""}`;
}

// Exporta la lista de pedidos que se le pase (ya filtrada/buscada por la
// tabla) a un CSV descargable. Todo se genera en el navegador, no pega a
// ningun backend.
function exportarPedidosCSV(pedidos: Pedido[]) {
  const headers = ["N° pedido", "Plataforma", "Fecha", "Cliente", "Total", "Estado", "Items", "Etiqueta"];

  const escape = (valor: unknown) => `"${String(valor ?? "").replace(/"/g, '""')}"`;

  const filas = pedidos.map((p) => [
    p.id_plataforma,
    p.plataforma,
    p.fecha_pedido ? formatFechaCorta(p.fecha_pedido) : "",
    p.cliente_nombre ?? "",
    p.total_pagado,
    ESTADO_LABELS[p.estado] ?? p.estado,
    (p.items ?? []).map(itemLabel).join(" | "),
    p.etiqueta_url ? "Si" : "No",
  ]);

  const csv = [headers, ...filas].map((fila) => fila.map(escape).join(",")).join("\r\n");
  // BOM para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Mismo dato que el CSV pero como .xlsx real (SheetJS), con anchos de
// columna, formato moneda en Total, autofiltro y encabezado congelado --
// para que se sienta como una planilla de verdad y no un volcado plano.
function exportarPedidosXLSX(pedidos: Pedido[]) {
  const filas = pedidos.map((p) => ({
    "N° pedido": p.id_plataforma,
    "Plataforma": p.plataforma,
    "Fecha": p.fecha_pedido ? formatFechaCorta(p.fecha_pedido) : "",
    "Cliente": p.cliente_nombre ?? "",
    "Total": p.total_pagado,
    "Estado": ESTADO_LABELS[p.estado] ?? p.estado,
    "Items": (p.items ?? []).map(itemLabel).join(" | "),
    "Etiqueta": p.etiqueta_url ? "Si" : "No",
  }));

  const ws = XLSX.utils.json_to_sheet(filas);

  ws["!cols"] = [
    { wch: 14 }, // N° pedido
    { wch: 10 }, // Plataforma
    { wch: 12 }, // Fecha
    { wch: 24 }, // Cliente
    { wch: 12 }, // Total
    { wch: 12 }, // Estado
    { wch: 50 }, // Items
    { wch: 10 }, // Etiqueta
  ];

  // Formato moneda (CLP, sin decimales) solo en la columna Total (indice 4).
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 4 });
    if (ws[cellRef]) ws[cellRef].z = '"$"#,##0';
  }

  ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
  ws["!views"] = [{ state: "frozen", ySplit: 1 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
  XLSX.writeFile(wb, `pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function OrderDetail({ pedido }: { pedido: Pedido }) {
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

  // Igual que en el historial del empacador: alcanza con un nombre por
  // pedido (todas las fotos suelen salir de la misma sesion de empaque).
  const empacadoPor = evidencias.find((e) => e.subido_por_usuario?.nombre)?.subido_por_usuario?.nombre;

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

          <div className="mt-4">
            <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Package className="h-3 w-3" /> Items
            </h4>
            {(pedido.items || []).length > 0 ? (
              <div className="space-y-1">
                {pedido.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <span className="flex-1">
                      <span className="mr-1 rounded bg-background px-1.5 py-0.5 text-[10px] border border-border">x{item.quantity}</span>
                      {item.title}
                      {item.sku && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">SKU: {item.sku}</span>}
                    </span>
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
          ) : evidencias.length > 0 ? (
            <>
              {empacadoPor && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Subido por <span className="font-medium text-foreground">{empacadoPor}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {evidencias.map((ev) => (
                  <a key={ev.id} href={getPublicUrl("evidencias", ev.url)} target="_blank" rel="noopener noreferrer"
                    className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-secondary">
                    <img src={getPublicUrl("evidencias", ev.url)} alt={ev.nombre_archivo ?? "Evidencia"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </a>
                ))}
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground">Sin evidencias</p>}
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
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Cierra el menu de exportar al hacer clic afuera, como cualquier
  // dropdown normal (si no, queda abierto colgando sobre la tabla).
  useEffect(() => {
    if (!exportOpen) return;
    const onClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [exportOpen]);

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
          className={cn("btn-premium inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
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
            className="btn-premium inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Ver cancelados
          </button>
        )}
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
        <div ref={exportRef} className="relative ml-auto shrink-0">
          <button
            onClick={() => setExportOpen((v) => !v)}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? "No hay pedidos para exportar" : `Exportar ${filtered.length} pedido${filtered.length === 1 ? "" : "s"}`}
            className="btn-premium inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
          >
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg animate-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => { exportarPedidosCSV(filtered); setExportOpen(false); }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                CSV
              </button>
              <button
                onClick={() => { exportarPedidosXLSX(filtered); setExportOpen(false); }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
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

      {/* Vista de tarjetas: mobile. La tabla con scroll horizontal funciona
          pero no es agradable al tacto, asi que por debajo de md se muestra
          como tarjetas apiladas (mismo lenguaje visual que "Ultimos pedidos"
          del dashboard) y se tocan para expandir el detalle. */}
      <div className="animate-in-soft space-y-2 md:hidden">
        {table.getRowModel().rows.map((row) => {
          const p = row.original;
          const abierto = expandedRows.has(p.id);
          return (
            <div key={row.id} className="card-premium overflow-hidden">
              <button
                type="button"
                onClick={() => toggleRow(p.id)}
                className="flex w-full items-start justify-between gap-3 p-3 text-left transition-colors active:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-sm font-semibold">{p.id_plataforma}</span>
                    <span className={cn("pill shrink-0", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                      {p.plataforma === "ML" ? "ML" : "FA"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.cliente_nombre || "Sin cliente"} · {formatFechaCorta(p.fecha_pedido)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">{formatCLP(p.total_pagado)}</span>
                    <EstadoBadge estado={p.estado} />
                    {p.etiqueta_url && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); window.open(pdfUrl(p.etiqueta_url!), "_blank"); }}
                        className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <FileText className="h-3 w-3 text-red-500" /> PDF
                      </span>
                    )}
                  </div>
                </div>
                {abierto ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {abierto && <OrderDetail pedido={p} />}
            </div>
          );
        })}
      </div>

      {/* Tabla: desktop */}
      <div className="hidden overflow-x-auto -mx-4 md:block md:mx-0">
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
        <EstadoVacio icon={PackageX} texto="No hay pedidos con esos filtros" />
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">
          {filtered.length > 0
            ? `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} de ${filtered.length}`
            : "0 resultados"
          }
        </span>
        <div className="flex gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="btn-premium rounded border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Anterior</button>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="btn-premium rounded border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Siguiente</button>
        </div>
      </div>
    </div>
  );
}
