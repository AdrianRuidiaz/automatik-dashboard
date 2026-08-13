"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, PackageX } from "lucide-react";
import { formatCLP } from "@/lib/utils";
import type { Producto } from "@/lib/types";
import { EstadoProductoBadge } from "@/components/productos/estado-producto-badge";
import { FiltroPills } from "@/components/pedidos/filtro-pills";
import { EstadoVacio } from "@/components/ui/estado-vacio";

interface CatalogoUnificadoTableProps {
  productos: Producto[];
}

// Un grupo = un producto fisico real. Se agrupa por sku_interno (asignado a
// mano por el dueño, ver comentario en Producto.sku_interno en lib/types.ts)
// para que la misma silicona/cerradura/etc. vendida en ML Y en Falabella
// aparezca como UNA fila, en vez de dos filas sueltas como en la vista "Por
// plataforma". Cuando sku_interno es null (publicacion sin SKU de vendedor
// en el origen -- ~2 filas ML en produccion), la fila se agrupa sola bajo
// una clave "plataforma+sku": asi nunca se pierde ni se mezcla por error con
// otro producto tambien sin SKU interno.
interface GrupoProducto {
  key: string;
  skuInterno: string | null;
  nombre: string;
  ml: Producto[];
  fa: Producto[];
}

type CoberturaFiltro = "all" | "ambas" | "solo_ml" | "solo_fa" | "desincronizados";

const COBERTURA_OPTIONS: { key: CoberturaFiltro; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ambas", label: "En ambas plataformas" },
  { key: "solo_ml", label: "Solo Mercado Libre" },
  { key: "solo_fa", label: "Solo Falabella" },
  { key: "desincronizados", label: "Activo en una, no en la otra" },
];

// sku_interno puede repetirse mas de una vez EN LA MISMA plataforma (ver
// CH1280CMI en produccion: 3 publicaciones ML distintas -- distintos colores
// -- comparten un mismo sku_interno porque son el mismo producto base). Por
// eso cada lado del grupo es un arreglo, no una sola publicacion: agrupar
// nunca debe asumir "a lo mas 1 fila por plataforma" o se pierden filas.
function agruparPorSkuInterno(productos: Producto[]): GrupoProducto[] {
  const grupos = new Map<string, GrupoProducto>();
  for (const p of productos) {
    const key = p.sku_interno ? `sku:${p.sku_interno}` : `single:${p.plataforma}:${p.sku}`;
    let grupo = grupos.get(key);
    if (!grupo) {
      grupo = { key, skuInterno: p.sku_interno, nombre: p.nombre ?? "Sin nombre", ml: [], fa: [] };
      grupos.set(key, grupo);
    }
    if (p.plataforma === "ML") grupo.ml.push(p);
    else grupo.fa.push(p);
    // Nombre representativo del grupo: se prefiere el nombre de ML (suele
    // ser el mas descriptivo en este catalogo); si ninguna fila ML tiene
    // nombre, se usa el primero disponible de Falabella.
    const nombreMl = grupo.ml.find((x) => x.nombre)?.nombre;
    const nombreFa = grupo.fa.find((x) => x.nombre)?.nombre;
    grupo.nombre = nombreMl ?? nombreFa ?? "Sin nombre";
  }
  return Array.from(grupos.values());
}

// "Activo en la plataforma" = alguna publicacion de esa plataforma dentro
// del grupo esta en estado "activo" (basta una, ver caso CH1280CMI arriba).
function estaActivoEnPlataforma(filas: Producto[]): boolean {
  return filas.some((f) => f.estado === "activo");
}

// Vista "Catalogo unificado": agrupa las publicaciones ML/FA por sku_interno
// para mostrar UN producto fisico por fila (pedido explicito del dueño:
// "unir los sku que son iguales"). No reemplaza la vista "Por plataforma"
// (productos-table.tsx) -- ambas se alimentan del mismo fetch/realtime,
// controlado por el toggle en productos/page.tsx.
export function CatalogoUnificadoTable({ productos }: CatalogoUnificadoTableProps) {
  const [search, setSearch] = useState("");
  const [cobertura, setCobertura] = useState<CoberturaFiltro>("all");

  const grupos = useMemo(() => agruparPorSkuInterno(productos), [productos]);

  const enriquecidos = useMemo(() => {
    return grupos.map((g) => {
      const mlActivo = estaActivoEnPlataforma(g.ml);
      const faActivo = estaActivoEnPlataforma(g.fa);
      const enAmbas = g.ml.length > 0 && g.fa.length > 0;
      // Bandera de desincronizacion: solo tiene sentido cuando el producto
      // esta publicado en AMBAS plataformas y una esta activa mientras la
      // otra no (pausada/sin stock/cerrada). Si solo esta en una plataforma,
      // eso ya se ve con el filtro "Solo ML"/"Solo FA" -- no es una alerta.
      const desincronizado = enAmbas && mlActivo !== faActivo;
      return { ...g, mlActivo, faActivo, enAmbas, desincronizado };
    });
  }, [grupos]);

  const filtrados = useMemo(() => {
    let data = enriquecidos;
    if (cobertura === "ambas") data = data.filter((g) => g.ml.length > 0 && g.fa.length > 0);
    else if (cobertura === "solo_ml") data = data.filter((g) => g.ml.length > 0 && g.fa.length === 0);
    else if (cobertura === "solo_fa") data = data.filter((g) => g.fa.length > 0 && g.ml.length === 0);
    else if (cobertura === "desincronizados") data = data.filter((g) => g.desincronizado);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (g) =>
          g.nombre.toLowerCase().includes(q) ||
          (g.skuInterno ?? "").toLowerCase().includes(q) ||
          g.ml.some((p) => p.sku.toLowerCase().includes(q)) ||
          g.fa.some((p) => p.sku.toLowerCase().includes(q))
      );
    }
    return data;
  }, [enriquecidos, cobertura, search]);

  // Resumen: sobre TODOS los grupos (no el filtrado), mismo criterio que el
  // resumen de ProductosTable -- la franja de arriba siempre refleja el
  // catalogo completo sin importar el filtro activo abajo.
  const resumen = useMemo(() => {
    const ambas = enriquecidos.filter((g) => g.ml.length > 0 && g.fa.length > 0).length;
    const soloMl = enriquecidos.filter((g) => g.ml.length > 0 && g.fa.length === 0).length;
    const soloFa = enriquecidos.filter((g) => g.fa.length > 0 && g.ml.length === 0).length;
    const desincronizados = enriquecidos.filter((g) => g.desincronizado).length;
    return { total: enriquecidos.length, ambas, soloMl, soloFa, desincronizados };
  }, [enriquecidos]);

  return (
    <div>
      <div className="card-premium mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 text-sm">
        <span className="font-medium">{resumen.total} productos</span>
        <span className="text-muted-foreground">
          {resumen.ambas} en ambas · {resumen.soloMl} solo ML · {resumen.soloFa} solo FA
        </span>
        {resumen.desincronizados > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {resumen.desincronizados} con diferencia entre plataformas
          </span>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex max-w-xs items-center gap-2 rounded-lg border border-input px-3 py-1.5 transition-colors focus-within:border-primary/40">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Buscar por nombre o SKU interno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cobertura</p>
          <FiltroPills options={COBERTURA_OPTIONS} value={cobertura} onChange={setCobertura} />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-medium">Catálogo unificado</h2>
        <span className="text-xs text-muted-foreground">{filtrados.length} de {resumen.total}</span>
      </div>

      {/* Mobile: tarjetas apiladas, mismo patron que ProductosTable. */}
      <div className="animate-in-soft space-y-2 md:hidden">
        {filtrados.map((g) => (
          <div key={g.key} className="card-premium p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{g.nombre}</p>
                  {g.desincronizado && (
                    <span
                      className="shrink-0"
                      title={g.mlActivo ? "Activo en ML pero no en Falabella" : "Activo en Falabella pero no en ML"}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{g.skuInterno ?? "(sin SKU interno)"}</p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <PlataformaCelda label="Mercado Libre" filas={g.ml} />
              <PlataformaCelda label="Falabella" filas={g.fa} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla card-premium. */}
      <div className="hidden md:block">
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Producto</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Mercado Libre</th>
                  <th className="eyebrow px-3 py-2.5 text-left font-medium">Falabella</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((g) => (
                  <tr key={g.key} className="row-hover border-b border-border align-top last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <p className="max-w-[220px] truncate font-medium">{g.nombre}</p>
                        {g.desincronizado && (
                          <span
                            title={g.mlActivo ? "Activo en ML pero no en Falabella" : "Activo en Falabella pero no en ML"}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{g.skuInterno ?? "(sin SKU interno)"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <PlataformaCelda filas={g.ml} />
                    </td>
                    <td className="px-3 py-2.5">
                      <PlataformaCelda filas={g.fa} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {filtrados.length === 0 && <EstadoVacio icon={PackageX} texto="No hay productos con esos filtros" />}
    </div>
  );
}

// Celda de una plataforma dentro del catalogo unificado: normalmente una
// sola publicacion, pero puede haber mas de una compartiendo el mismo
// sku_interno (ver CH1280CMI/CH1270SMC en produccion) -- se listan todas,
// nunca se descarta ninguna para "simplificar" la celda. "No publicado"
// cuando el grupo no tiene ninguna fila de esta plataforma.
function PlataformaCelda({ filas, label }: { filas: Producto[]; label?: string }) {
  if (filas.length === 0) {
    return (
      <div>
        {label && <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>}
        <span className="text-xs text-muted-foreground">No publicado</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label && <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>}
      {filas.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <EstadoProductoBadge estado={p.estado} />
          <span className="tabular text-xs text-muted-foreground">Stock: {p.stock ?? "—"}</span>
          {p.precio != null && <span className="tabular text-xs text-muted-foreground">{formatCLP(p.precio)}</span>}
        </div>
      ))}
    </div>
  );
}
