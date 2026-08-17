// Tarea: filtro de rango de fechas en las tarjetas KPI del dashboard.
// Centraliza aca las 5 opciones fijas y el calculo de "periodo actual vs
// periodo anterior equivalente" para que page.tsx y kpi-cards.tsx no
// dupliquen esta logica.
//
// Los periodos estan anclados al calendario (no son ventanas rodantes de
// "hoy menos N dias"). Ej.: "1 mes" es "desde el 1 del mes actual hasta
// ahora", no "hoy menos 30 dias" -- asi coincide con lo que el dueno del
// negocio espera ver al elegir "este mes".

export type RangoKpi = "1s" | "1m" | "3m" | "6m" | "12m";

export const RANGO_KPI_DEFAULT: RangoKpi = "1m";

export const RANGOS_KPI: { value: RangoKpi; label: string }[] = [
  { value: "1s", label: "1 semana" },
  { value: "1m", label: "1 mes" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

// Lunes 00:00:00 de la semana ISO (lunes a domingo) que contiene `fecha`.
// getDay() devuelve 0=domingo..6=sabado; se calcula cuantos dias hay que
// retroceder para llegar al lunes, tratando el domingo como el ultimo dia
// de la semana (6 dias despues del lunes) en vez del primero.
function lunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
  const dow = d.getDay();
  const diasDesdeLunes = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diasDesdeLunes);
  return d;
}

// Ultimo instante del dia de `fecha` (23:59:59.999), en hora local.
function finDeDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Dia 1 del mes que es `mesesAtras` meses antes del mes de `fecha`, a las
// 00:00:00 local. Se construye un Date nuevo con dia=1 explicito (no se
// mutan los campos de una fecha existente con setMonth), asi se evita el
// bug clasico de JS Date donde restar un mes a un dia 29/30/31 puede
// "desbordar" hacia el mes siguiente si el mes destino tiene menos dias
// (ej. 31 de enero - 1 mes con setMonth cae en 3 de marzo, no en febrero).
// Ademas, pasar un indice de mes negativo al constructor de Date es seguro:
// JS lo normaliza retrocediendo los anios que hagan falta (ej. mes -1 de
// 2026 es diciembre de 2025).
function primerDiaMes(fecha: Date, mesesAtras: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() - mesesAtras, 1, 0, 0, 0, 0);
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
  prevDesde: Date;
  prevHasta: Date;
}

// Periodo actual: [desde, hasta]. Periodo anterior: el bloque calendario
// completo inmediatamente antes de `desde`.
//
// - "1 semana": desde = lunes de la semana actual, hasta = ahora. Anterior
//   = la semana calendario completa previa (lunes a domingo 23:59:59.999).
// - "1m"/"3m"/"6m"/"12m": desde = dia 1 del mes que queda (N-1) meses antes
//   del mes actual (asi el bloque cubre N meses calendario en total, con el
//   mes actual incompleto), hasta = ahora. Anterior = el bloque de N meses
//   calendario completos inmediatamente anterior (prevHasta === desde, sin
//   solapamiento ni hueco; prevDesde = dia 1 del mes (2N-1) meses antes del
//   actual).
export function calcularRangoFechas(rango: RangoKpi, ahora: Date = new Date()): RangoFechas {
  const hasta = new Date(ahora);

  if (rango === "1s") {
    const desde = lunesDeSemana(ahora);
    const prevDesde = new Date(desde);
    prevDesde.setDate(prevDesde.getDate() - 7);
    const domingoAnterior = new Date(desde);
    domingoAnterior.setDate(domingoAnterior.getDate() - 1);
    const prevHasta = finDeDia(domingoAnterior);
    return { desde, hasta, prevDesde, prevHasta };
  }

  const meses: Record<Exclude<RangoKpi, "1s">, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
  const n = meses[rango];
  const desde = primerDiaMes(ahora, n - 1);
  const prevHasta = new Date(desde);
  const prevDesde = primerDiaMes(ahora, 2 * n - 1);
  return { desde, hasta, prevDesde, prevHasta };
}
