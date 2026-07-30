import { cn } from "@/lib/utils";
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoPedido } from "@/lib/types";

interface EstadoBadgeProps {
  estado: EstadoPedido;
  className?: string;
}

// Componente compartido para mostrar el estado de un pedido como badge de
// color. Se usa tanto en la vista de Admin (orders-table.tsx) como en la de
// Vendedor (tax-docs-table.tsx) para que el mismo estado se vea siempre
// igual en toda la app.
export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  return (
    <span className={cn("pill inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium md:text-[11px]", ESTADO_COLORS[estado], className)}>
      {ESTADO_LABELS[estado]}
    </span>
  );
}
