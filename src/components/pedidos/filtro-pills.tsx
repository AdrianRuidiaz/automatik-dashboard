import { cn } from "@/lib/utils";

interface FiltroPillsProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

// Fila de botones de filtro (pills) reutilizable. Antes esta misma
// estructura estaba duplicada casi idéntica en orders-table.tsx (filtro de
// estado) y en tax-docs-table.tsx (filtro de tipo de documento). Se extrae
// aquí para no repetir el markup/estilos y para que la vista de Vendedor
// pueda agregar un filtro por estado del pedido con el mismo componente.
export function FiltroPills<T extends string>({ options, value, onChange, className }: FiltroPillsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            value === opt.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-card text-muted-foreground hover:border-primary/30"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
