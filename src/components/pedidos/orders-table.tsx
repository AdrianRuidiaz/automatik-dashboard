"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Download, FileText, ChevronDown, ChevronRight, Package, Info, Camera, Image } from "lucide-react";
import { cn, formatCLP, formatFechaCorta, formatFechaLarga } from "@/lib/utils";
import { fetchArchivos } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Pedido, Plataforma, Archivo } from "@/lib/types";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";

interface OrdersTableProps { pedidos: Pedido[]; }

function OrderDetail({ pedido }: { pedido: Pedido }) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchivos(pedido.id).then(setArchivos).catch(console.error).finally(() => setLoading(false));
  }, [pedido.id]);

  const evidencias = archivos.filter(a => a.tipo === "evidencia");
  const documentos = archivos.filter(a => a.tipo === "documento_tributario");
  const etiquetas = archivos.filter(a => a.tipo === "etiqueta");

  const getPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 bg-card/50">
      <div>
        <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Info className="h-3 w-3" /> Informacion
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-xs text-muted-foreground">Cliente</span><p className="font-medium">{pedido.cliente_nombre || "\u2014"}</p></div>
          <div><span className="text-xs text-muted-foreground">Fecha</span><p>{formatFechaLarga(pedido.fecha_pedido)}</p></div>
          <div><span className="text-xs text-muted-foreground">Total</span><p className="font-medium">{formatCLP(pedido.total_pagado)}</p></div>
          <div><span className="text-xs text-muted-foreground">Limite despacho</span><p className="text-amber-600">{formatFechaLarga(pedido.fecha_limite_despacho)}</p></div>
          <div><span className="text-xs text-muted-foreground">Pack ID</span><p className="font-mono text-xs">{pedido.id_plataforma}</p></div>
          <div><span className="text-xs text-muted-foreground">Order ID</span><p className="font-mono text-xs">{pedido.order_id}</p></div>
        </div>
        <div className="mt-3">
          <h4 className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Package className="h-3 w-3" /> Items</h4>
          {(pedido.items || []).length > 0 ? (
            <div className="space-y-1">
              {pedido.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span><span className="mr-1 rounded bg-secondary px-1 py-0.5 text-[10px]">x{item.quantity}</span>{item.title}</span>
                  <span className="text-muted-foreground">{formatCLP(item.unit_price)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Sin items</p>}
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Camera className="h-3 w-3" /> Evidencias de empaque
        </h4>
        {loading ? <p className="text-xs text-muted-foreground">Cargando...</p> : evidencias.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {evidencias.map((ev) => (
              <a key={ev.id} href={getPublicUrl("evidencias", ev.storage_path)} target="_blank" rel="noopener noreferrer"
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-secondary">
                <img src={getPublicUrl("evidencias", ev.storage_path)} alt={ev.nombre_archivo}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </a>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">Sin evidencias subidas</p>}

        <h4 className="mt-4 mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileText className="h-3 w-3" /> Etiqueta
        </h4>
        {pedido.etiqueta_url ? (
          <a href={pedido.etiqueta_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-input px-3 py-1.5 text-xs hover:bg-secondary">
            <FileText className="h-3 w-3 text-red-500" /> Descargar PDF
          </a>
        ) : etiquetas.length > 0 ? (
          <a href={getPublicUrl("etiquetas", etiquetas[0].storage_path)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-input px-3 py-1.5 text-xs hover:bg-secondary">
            <FileText className="h-3 w-3 text-red-500" /> Descargar PDF
          </a>
        ) : <p className="text-xs text-muted-foreground">Sin etiqueta</p>}
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileText className="h-3 w-3" /> Documentos tributarios
        </h4>
        {loading ? <p className="text-xs text-muted-foreground">Cargando...</p> : documentos.length > 0 ? (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <a key={doc.id} href={getPublicUrl("documentos", doc.storage_path)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-secondary">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium capitalize">{doc.subtipo || "Documento"}</p>
                  <p className="text-muted-foreground">{doc.nombre_archivo}</p>
                </div>
              </a>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">Sin documentos tributarios</p>}
      </div>
    </div>
  );
}

export function OrdersTable({ pedidos }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | Plataforma>("all");
  const [onlyPending, setOnlyPending] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const filtered = useMemo(() => {
    let data = pedidos;
    if (platformFilter !== "all") data = data.filter((p) => p.plataforma === platformFilter);
    if (onlyPending) data = data.filter((p) => ["pending", "paid", "ready_to_ship"].includes(p.estado));
    return data;
  }, [pedidos, platformFilter, onlyPending]);

  const columns: ColumnDef<Pedido>[] = useMemo(() => [
    { id: "expand", header: "", cell: ({ row }) => (
        <button className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); toggleRow(row.original.id); }}>
          {expandedRows.has(row.original.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>), size: 32 },
    { accessorKey: "id_plataforma", header: ({ column }) => (<button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>N\u00b0 pedido <ArrowUpDown className="h-3 w-3" /></button>),
      cell: ({ row }) => <span className="font-medium">{row.original.id_plataforma}</span> },
    { accessorKey: "plataforma", header: "Plat.", cell: ({ row }) => <span className={cn("inline-block rounded px-2 py-0.5 text-[11px]", row.original.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>{row.original.plataforma === "ML" ? "ML" : "FA"}</span> },
    { accessorKey: "fecha_pedido", header: ({ column }) => (<button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>Fecha <ArrowUpDown className="h-3 w-3" /></button>), cell: ({ row }) => formatFechaCorta(row.original.fecha_pedido) },
    { accessorKey: "cliente_nombre", header: "Cliente", cell: ({ row }) => row.original.cliente_nombre ?? "\u2014" },
    { id: "items_preview", header: "Items", cell: ({ row }) => { const t = (row.original.items ?? []).map(i => i.title).join(", "); return <span className="block max-w-[160px] truncate text-xs text-muted-foreground">{t || "\u2014"}</span>; } },
    { accessorKey: "total_pagado", header: ({ column }) => (<button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>Total <ArrowUpDown className="h-3 w-3" /></button>), cell: ({ row }) => formatCLP(row.original.total_pagado) },
    { accessorKey: "estado", header: "Estado", cell: ({ row }) => <span className={cn("inline-block rounded px-2 py-0.5 text-[11px]", ESTADO_COLORS[row.original.estado])}>{ESTADO_LABELS[row.original.estado]}</span> },
    { id: "etiqueta", header: "Etiqueta", cell: ({ row }) => row.original.etiqueta_url ? (
        <button className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
          onClick={(e) => { e.stopPropagation(); window.open(row.original.etiqueta_url!, "_blank"); }}>
          <FileText className="h-3.5 w-3.5 text-red-500" /></button>) : <span className="text-xs text-muted-foreground">\u2014</span> },
  ], [expandedRows]);

  const table = useReactTable({ data: filtered, columns, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } } });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-medium">Pedidos</h2><span className="text-xs text-muted-foreground">{filtered.length} pedidos</span></div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por N\u00b0 pedido, cliente..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-44 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        {(["all", "ML", "Falabella"] as const).map((opt) => (
          <button key={opt} onClick={() => setPlatformFilter(opt)} className={cn("rounded-md border px-3 py-1.5 text-xs transition-colors", platformFilter === opt ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>{opt === "all" ? "Todos" : opt === "ML" ? "ML" : "FA"}</button>
        ))}
        <button onClick={() => setOnlyPending((v) => !v)} className={cn("rounded-md border px-3 py-1.5 text-xs transition-colors", onlyPending ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground")}>Pendientes</button>
        <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /> Exportar</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>{table.getHeaderGroups().map((hg) => (<tr key={hg.id}>{hg.headers.map((h) => (<th key={h.id} className="border-b border-border px-2 py-2 text-left text-xs font-normal text-muted-foreground">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>))}</tr>))}</thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <>{/* eslint-disable-next-line react/jsx-key */}
                <tr key={row.id} className="cursor-pointer border-b border-border hover:bg-secondary/50" onClick={() => toggleRow(row.original.id)}>
                  {row.getVisibleCells().map((cell) => (<td key={cell.id} className="px-2 py-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>))}
                </tr>
                {expandedRows.has(row.original.id) && (
                  <tr key={row.id + "-detail"}><td colSpan={columns.length} className="border-b border-border p-0"><OrderDetail pedido={row.original} /></td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}\u2013{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} de {filtered.length}</span>
        <div className="flex gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded border border-input px-2.5 py-1 disabled:opacity-40">Anterior</button>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded border border-input px-2.5 py-1 disabled:opacity-40">Siguiente</button>
        </div>
      </div>
    </div>
  );
}
