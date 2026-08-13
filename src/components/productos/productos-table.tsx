"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search, PackageX } from "lucide-react";
import { cn, formatRelativo } from "@/lib/utils";
import type { Producto, PlataformaProducto, EstadoProducto } from "@/lib/types";
import { EstadoProductoBadge } from "@/components/productos/estado-producto-badge";
import { FiltroPills } from "@/components/pedidos/filtro-pills";
import { EstadoVacio } from "@/components/ui/estado-vacio";

interface ProductosTableProps {
  productos: Producto[];
}

const PLATAFORMA_OPTIONS: { key: "all" | PlataformaProducto; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ML", label: "Mercado Libre" },
  { key: "FA", label: "Falabella" },
];

const ESTADO_OPTIONS: { key: "all" | EstadoProducto; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "activo", label: "Activo" },
  { key: "pausado", label: "Pausado" },
  { key: "sin_stock", label: "Sin stock" },
  { key: "cerrado", label: "Cerrado" },
];

// Mismo lenguaje visual que orders-table.tsx (pedidos): busqueda + pills de
// filtro, tarjetas apiladas en mobile, tabla card-premium en desktop. Esta
// tabla es deliberadamente mas simple (sin @tanstack/react-table, sin
// paginacion ni expansion de fila) porque el catalogo de productos no tiene
// el detalle multi-item ni el flujo de estados que tiene un pedido.
export function ProductosTable({ productos }: ProductosTableProps) {
  const [platformFilter, setPlatformFilter] = useState<"all" | PlataformaProducto>("all");
  const [estadoFilter, setEstadoFilter] = useState<"all" | EstadoProducto>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let data = productos;
    if (platformFilter !== "all") data = data.filter((p) => p.plataforma === platformFilter);
    if (estadoFilter !== "all") data = data.filter((p) => p.estado === estadoFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (p) => (p.nombre ?? "").toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    return data;
  }, [productos, platformFilter, estadoFilter, search]);

  // Resumen: cuenta sobre TODOS los productos del cliente (no sobre el
  // filtrado), para que la franja de arriba siempre refleje el estado real
  // del catalogo completo sin importar que filtro este activo abajo.
  const resumen = useMemo(() => {
    const porEstado: Record<EstadoProducto, number> = { activo: 0, pausado: 0, sin_stock: 0, cerrado: 0 };
    let ml = 0;
    let fa = 0;
    for (const p of productos) {
      porEstado[p.estado]++;
      if (p.plataforma === "ML") ml++;
      else fa++;
    }
    return { porEstado, ml, fa, total: productos.length };
  }, [productos]);

  return (
    <div>
      {/* Resumen: conteos simples, no necesita ser tan elaborado como las
          tarjetas KPI del dashboard (ver dashboard/kpi-cards.tsx). */}
      <div className="card-premium mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 text-sm">
        <span className="font-medium">{resumen.total} productos</span>
        <span className="text-muted-foreground">{resumen.ml} ML · {resumen.fa} FA</span>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {resumen.porEstado.activo} activos
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {resumen.porEstado.pausado} pausados
        </span>
        <span className="inline-flex items-center gap-1.5 text-orange-600">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> {resumen.porEstado.sin_stock} sin stock
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {resumen.porEstado.cerrado} cerrados
        </span>
      </div>

      {/* Filtros: busqueda + pills (mismo componente FiltroPills que usa la
          vista de Vendedor para filtrar documentos). */}
      <div className="mb-4 space-y-3">
        <div className="flex max-w-xs items-center gap-2 rounded-lg border border-input px-3 py-1.5 transition-colors focus-within:border-primary/40">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Plataforma</p>
          <FiltroPills options={PLATAFORMA_OPTIONS} value={platformFilter} onChange={setPlatformFilter} />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Estado</p>
          <FiltroPills options={ESTADO_OPTIONS} value={estadoFilter} onChange={setEstadoFilter} />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-medium">Publicaciones</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} de {resumen.total}</span>
      </div>

      {/* Mobile: tarjetas apiladas (mismo patron que orders-table.tsx). */}
      <div className="animate-in-soft space-y-2 md:hidden">
        {filtered.map((p) => (
          <div key={p.id} className="card-premium p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("pill shrink-0", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                    {p.plataforma}
                  </span>
                  <EstadoProductoBadge estado={p.estado} />
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{p.nombre ?? "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground">{p.sku || "Sin SKU"}</p>
              </div>
              {p.url_publicacion && (
                <a
                  href={p.url_publicacion}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded border border-input p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular">Stock: <span className="font-medium text-foreground">{p.stock ?? "—"}</span></span>
              <span>{formatRelativo(p.ultima_sync)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla card-premium (mismo lenguaje visual que orders-table.tsx). */}
      <div className="hidden md:block">
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Producto</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Plat.</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Estado</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Stock</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Link</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Sync</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="row-hover border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <p className="max-w-[240px] truncate font-medium">{p.nombre ?? "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{p.sku || "Sin SKU"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] md:text-[11px]", p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
                        {p.plataforma}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><EstadoProductoBadge estado={p.estado} /></td>
                    <td className="tabular px-3 py-2.5">{p.stock ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {p.url_publicacion ? (
                        <a
                          href={p.url_publicacion}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Ver
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatRelativo(p.ultima_sync)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {filtered.length === 0 && <EstadoVacio icon={PackageX} texto="No hay productos con esos filtros" />}
    </div>
  );
}
