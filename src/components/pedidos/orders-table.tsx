"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Download, FileText, ChevronDown, ChevronRight, CalendarDays, Filter, X, PackageX } from "lucide-react";
import { cn, formatCLP, formatFechaCorta } from "@/lib/utils";
import { exportarPedidosCSV, exportarPedidosXLSX } from "@/lib/export-pedidos";
import type { Pedido, Plataforma, EstadoPedido } from "@/lib/types";
import { EstadoBadge } from "@/components/pedidos/estado-badge";
import { OrderDetail } from "@/components/pedidos/order-detail";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { PdfLink } from "@/components/pedidos/pdf-link";

// Filtro pseudo-estado usado solo en esta tabla, no existe como valor real
// de pedido.estado. Combina "paid" + "ready_to_ship" -- lo mismo que cuenta
// la tarjeta KPI "Por despachar" del dashboard (ver kpi-cards.tsx /
// fetchDashboardResumen). Se linkea aca via ?filtro=por_despachar.
//
// Caso especial pedido por el negocio: los pedidos Falabella en estado
// "pending" tambien cuentan como "por despachar" (Falabella los reporta asi
// via GetOrder/Status y el dueno los quiere ver en el bucket de despacho).
// Esto es SOLO para Falabella -- no aplica a ML. Ver esFalabellaPending()
// mas abajo y su equivalente en la RPC public.dashboard_kpis_rango, que
// debe coincidir exactamente con esta regla.
type EstadoFilterValue = "all" | "por_despachar" | EstadoPedido;
const ESTADOS_QUE_CUENTAN_POR_DESPACHAR: EstadoPedido[] = ["paid", "ready_to_ship"];
const esFalabellaPending = (p: Pedido) => p.plataforma === "Falabella" && p.estado === "pending";

interface OrdersTableProps {
  pedidos: Pedido[];
  /** Filtro de estado inicial (ej. llegando desde el link de la tarjeta KPI). Default "all". */
  initialEstadoFilter?: EstadoFilterValue;
  /**
   * Tarea #75: ids especificos a mostrar (ej. ?ids=uuid1,uuid2,uuid3 desde
   * un push que agrupa varios pedidos urgentes o varias anomalias del
   * chequeo de salud). Cuando esta presente y no vacio, la tabla muestra
   * SOLO estos pedidos (match por el id interno de Supabase) e ignora
   * cualquier otro filtro activo (estado/plataforma/fecha). Un solo id en
   * la lista funciona igual, mostrando unicamente ese pedido.
   */
  filtroIds?: string[] | null;
}

const ESTADOS_FILTER: { key: EstadoFilterValue; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "por_despachar", label: "Por despachar" },
  { key: "not_paid", label: "Sin pagar" },
  { key: "pending", label: "Pendiente" },
  { key: "paid", label: "Pagado" },
  { key: "ready_to_ship", label: "Listo" },
  { key: "shipped", label: "Enviado" },
  { key: "delivered", label: "Entregado" },
  { key: "cancelled", label: "Cancelado" },
  { key: "returned", label: "Devuelto" },
];

export function OrdersTable({ pedidos, initialEstadoFilter = "all", filtroIds = null }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | Plataforma>("all");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilterValue>(initialEstadoFilter);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // El padre (app/pedidos/page.tsx) lee el query param ?filtro=... recien
  // en un efecto (para no romper hidratacion con window.location durante el
  // render). Esta tabla ya se monto para entonces con estadoFilter="all",
  // asi que hace falta este efecto para aplicar el filtro cuando el padre
  // termina de leerlo. No pisa cambios manuales del usuario despues, porque
  // initialEstadoFilter del padre solo cambia una vez, justo despues del
  // mount.
  useEffect(() => {
    if (initialEstadoFilter !== "all") setEstadoFilter(initialEstadoFilter);
  }, [initialEstadoFilter]);

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
    // Tarea #75: ?ids=... manda por sobre cualquier otro filtro -- se usa
    // para deep links de push que agrupan varios pedidos puntuales (ej.
    // "3 pedidos urgentes: vencen hoy"), asi que el resultado debe ser
    // exactamente esos pedidos, sin importar estado/plataforma/fecha
    // seleccionados en la tabla.
    if (filtroIds && filtroIds.length > 0) {
      const idsSet = new Set(filtroIds);
      return pedidos.filter((p) => idsSet.has(p.id));
    }

    let data = pedidos;
    // Tarea: manejo de pedidos cancelados. "Todos" en el filtro de estado
    // significa "todos los pedidos activos": los cancelados nunca se
    // mezclan por defecto, solo aparecen cuando se elige explícitamente
    // el filtro "Cancelado".
    if (estadoFilter === "all") {
      data = data.filter((p) => p.estado !== "cancelled");
    } else if (estadoFilter === "por_despachar") {
      data = data.filter((p) => ESTADOS_QUE_CUENTAN_POR_DESPACHAR.includes(p.estado) || esFalabellaPending(p));
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
  }, [pedidos, platformFilter, estadoFilter, fechaDesde, fechaHasta, filtroIds]);

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
      // Preview de items en la fila colapsada. Antes mostraba todos los
      // titulos concatenados dentro de un contenedor con max-w-[160px] y
      // truncate: en un pedido multi-item (packs ML, multi-item Falabella)
      // eso recortaba silenciosamente la lista sin ninguna pista de que
      // habia mas productos aparte del primero. Ahora se muestra solo el
      // primer item + un badge "+N" para que un pedido multi-item se note
      // de un vistazo sin tener que expandir la fila. La lista completa
      // (todos los items, sin recortar) siempre esta disponible al expandir
      // -> ver OrderDetail (order-detail.tsx), que ya itera pedido.items
      // completo.
      id: "items_preview", header: "Items",
      cell: ({ row }) => {
        const items = row.original.items ?? [];
        if (items.length === 0) {
          return <span className="hidden lg:block text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="hidden lg:flex items-center gap-1 max-w-[160px]">
            <span className="truncate text-xs text-muted-foreground">{items[0].title}</span>
            {items.length > 1 && (
              <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{items.length - 1}
              </span>
            )}
          </span>
        );
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
        <PdfLink url={row.original.etiqueta_url} stopPropagation
          className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-60">
          <FileText className="h-3.5 w-3.5 text-red-500" />
          <span className="hidden md:inline">PDF</span>
        </PdfLink>
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
        <div className="flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 flex-1 min-w-0 max-w-xs transition-colors focus-within:border-primary/40">
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
            <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-xl border border-border/60 bg-card py-1 shadow-xl animate-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => { exportarPedidosCSV(filtered); setExportOpen(false); }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
              >
                CSV
              </button>
              <button
                onClick={() => {
                  // exportarPedidosXLSX carga la libreria xlsx con import()
                  // dinamico recien al hacer click aca (ver
                  // lib/export-pedidos.ts) -- es async, asi que se atrapa
                  // cualquier error de la carga/generacion en vez de dejar
                  // una promesa rechazada sin manejar.
                  void exportarPedidosXLSX(filtered).catch((err) => console.error("Error exportando XLSX:", err));
                  setExportOpen(false);
                }}
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
        <div className="card-premium mb-4 p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
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
                      <PdfLink url={p.etiqueta_url} as="span" stopPropagation
                        className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3 text-red-500" /> PDF
                      </PdfLink>
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

      {/* Tabla: desktop. card-premium + encabezados "eyebrow" + row-hover
          dorado -- mismo lenguaje visual que la tabla "Ultimos pedidos" del
          dashboard. Esta es la tabla que mas se usa (el corazon de la app),
          antes se veia plana (tabla suelta sin card, hover gris generico)
          en comparacion con el resto de la interfaz. */}
      <div className="hidden md:block">
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border bg-secondary/40">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="eyebrow px-3 py-2.5 text-left font-medium whitespace-nowrap">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="row-hover cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40"
                      onClick={() => toggleRow(row.original.id)}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {expandedRows.has(row.original.id) && (
                      <tr>
                        <td colSpan={columns.length} className="border-b border-border p-0">
                          <OrderDetail pedido={row.original} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
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
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="btn-premium rounded-lg border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Anterior</button>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="btn-premium rounded-lg border border-input px-3 py-1 disabled:opacity-40 hover:bg-secondary">Siguiente</button>
        </div>
      </div>
    </div>
  );
}
