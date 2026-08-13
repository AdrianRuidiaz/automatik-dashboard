import { cn } from "@/lib/utils";
import { ESTADO_PRODUCTO_COLORS, ESTADO_PRODUCTO_LABELS, type EstadoProducto } from "@/lib/types";

interface EstadoProductoBadgeProps {
  estado: EstadoProducto;
  className?: string;
}

// Mismo patron que EstadoBadge (pedidos/estado-badge.tsx): un solo lugar
// para el color/label de cada estado de producto, reusado en la tabla
// desktop y en las tarjetas mobile de productos-table.tsx.
export function EstadoProductoBadge({ estado, className }: EstadoProductoBadgeProps) {
  return (
    <span className={cn("pill inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium md:text-[11px]", ESTADO_PRODUCTO_COLORS[estado], className)}>
      {ESTADO_PRODUCTO_LABELS[estado]}
    </span>
  );
}
