"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Download, FileText } from "lucide-react";
import { cn, formatCLP, formatFechaCorta } from "@/lib/utils";
import type { Pedido, Plataforma } from "@/lib/types";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";

interface OrdersTableProps {
  pedidos: Pedido[];
}

export function OrdersTable({ pedidos }: OrdersTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | Plataforma>("all");
  const [onlyPending, setOnlyPending] = useState(false);

  const filtered = useMemo(() => {
    let data = pedidos;
    if (platformFilter !== "all") {
      data = data.filter((p) => p.plataforma === platformFilter);
    }
    if (onlyPending) {
      data = data.filter((p) =>
        ["pending", "paid", "ready_to_ship"].includes(p.estado)
      );
    }
    return data;
  }, [pedidos, platformFilter, onlyPending]);

  const columns: ColumnDef<Pedido>[] = useMemo(
    () => [
      {
        accessorKey: "id_plataforma",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            N° pedido <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.id_plataforma}</span>
        ),
      },
      {
        accessorKey: "plataforma",
        header: "Plat.",
        cell: ({ row }) => {
          const p = row.original.plataforma;
          return (
            <span
              className={cn(
                "inline-block rounded px-2 py-0.5 text-[11px]",
                p === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark"
              )}
            >
              {p === "ML" ? "ML" : "FA"}
            </span>
          );
        },
      },
      {
        accessorKey: "fecha_pedido",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            Fecha <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => formatFechaCorta(row.original.fecha_pedido),
      },
      {
        accessorKey: "cliente_nombre",
        header: "Cliente",
        cell: ({ row }) => row.original.cliente_nombre ?? "—",
      },
      {
        id: "items_preview",
        header: "Items",
        cell: ({ row }) => {
          const items = row.original.items ?? [];
          const text = items.map((i) => i.title).join(", ");
          return (
            <span className="block max-w-[160px] truncate text-xs text-muted-foreground">
              {text || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "total_pagado",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            Total <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => formatCLP(row.original.total_pagado),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const estado = row.original.estado;
          return (
            <span
              className={cn(
                "inline-block rounded px-2 py-0.5 text-[11px]",
                ESTADO_COLORS[estado]
              )}
            >
              {ESTADO_LABELS[estado]}
            </span>
          );
        },
      },
      {
        id: "etiqueta",
        header: "Etiqueta",
        cell: ({ row }) =>
          row.original.etiqueta_url ? (
            <button
              className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
              onClick={(e) => {
                e.stopPropagation();
                window.open(row.original.etiqueta_url!, "_blank");
              }}
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium">Pedidos</h2>
        <span className="text-xs text-muted-foreground">
          {filtered.length} pedidos
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por N° pedido, cliente..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-44 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {(["all", "ML", "Falabella"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setPlatformFilter(opt)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors",
              platformFilter === opt
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:text-foreground"
            )}
          >
            {opt === "all" ? "Todos" : opt === "ML" ? "ML" : "FA"}
          </button>
        ))}

        <button
          onClick={() => setOnlyPending((v) => !v)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs transition-colors",
            onlyPending
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:text-foreground"
          )}
        >
          Pendientes
        </button>

        <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="border-b border-border px-2 py-2 text-left text-xs font-normal text-muted-foreground"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-border hover:bg-secondary/50"
                onClick={() => router.push(`/pedidos/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando{" "}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}
          –
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            filtered.length
          )}{" "}
          de {filtered.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border border-input px-2.5 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-input px-2.5 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
