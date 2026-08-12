// Tarea: filtro de rango de fechas en las tarjetas KPI del dashboard.
// Centraliza aca las 5 opciones fijas y el calculo de "periodo actual vs
// periodo anterior equivalente" para que page.tsx y kpi-cards.tsx no
// dupliquen esta logica.

export type RangoKpi = "1s" | "1m" | "3m" | "6m" | "12m";

export const RANGO_KPI_DEFAULT: RangoKpi = "1m";

export const RANGOS_KPI: { value: RangoKpi; label: string }[] = [
  { value: "1s", label: "1 semana" },
  { value: "1m", label: "1 mes" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

// "1 semana" se resta en dias (siempre 7); el resto en meses via setMonth
// para que "1 mes atras" respete la duracion real del mes calendario (ej.
// 12 de agosto -> 12 de julio) en vez de una aproximacion fija en dias.
function restarPeriodo(fecha: Date, rango: RangoKpi): Date {
  const d = new Date(fecha);
  if (rango === "1s") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  const meses: Record<Exclude<RangoKpi, "1s">, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
  d.setMonth(d.getMonth() - meses[rango]);
  return d;
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
  prevDesde: Date;
  prevHasta: Date;
}

// Periodo actual: [desde, hasta). Periodo anterior: el bloque de igual
// duracion inmediatamente antes (prevHasta === desde, sin solapamiento ni
// hueco), para que la comparacion "vs periodo anterior" sea equivalente.
export function calcularRangoFechas(rango: RangoKpi, ahora: Date = new Date()): RangoFechas {
  const hasta = new Date(ahora);
  const desde = restarPeriodo(hasta, rango);
  const prevHasta = new Date(desde);
  const prevDesde = restarPeriodo(prevHasta, rango);
  return { desde, hasta, prevDesde, prevHasta };
}
