"use client";

import { cn } from "@/lib/utils";
import { RANGOS_KPI, type RangoKpi } from "@/lib/date-ranges";

interface KpiRangeFilterProps {
  value: RangoKpi;
  onChange: (rango: RangoKpi) => void;
}

// Mismo patron visual que el selector de pestañas del empacador/vendedor en
// page.tsx (bg-secondary/70 + pill activa con bg-card shadow-sm), para no
// meter un componente de segmented control nuevo al lenguaje visual del
// dashboard.
export function KpiRangeFilter({ value, onChange }: KpiRangeFilterProps) {
  return (
    <div className="flex gap-0.5 overflow-x-auto rounded-xl bg-secondary/70 p-1" role="tablist" aria-label="Rango de fechas de las tarjetas KPI">
      {RANGOS_KPI.map((rango) => (
        <button
          key={rango.value}
          type="button"
          role="tab"
          aria-selected={value === rango.value}
          onClick={() => onChange(rango.value)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === rango.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {rango.label}
        </button>
      ))}
    </div>
  );
}
