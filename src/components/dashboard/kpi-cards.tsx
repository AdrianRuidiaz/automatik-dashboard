"use client";

import Link from "next/link";
import { Package, DollarSign, Truck, XCircle, Receipt, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import type { DashboardResumen } from "@/lib/types";
import { CountUp } from "@/components/ui/count-up";

interface KpiCardsProps {
  data: DashboardResumen | null;
  /** KPIs del periodo anterior equivalente (ver calcularRangoFechas), para
   *  calcular el delta % que muestra cada tarjeta. null mientras carga o si
   *  todavia no hay datos suficientes. */
  previousData?: DashboardResumen | null;
}

// Para casi todos los KPIs "sube = mejora" (mas pedidos, mas ingresos, ticket
// promedio mas alto). Pero "por_despachar" (menos pedidos estancados es
// mejor) y "cancelados"/"tasa_cancelacion" (menos cancelaciones es mejor) van
// al reves -- por eso el delta nunca asume una direccion fija, cada tarjeta
// declara la suya.
type DireccionBuena = "sube" | "baja";

// null cuando no hay base de comparacion valida (periodo anterior en 0 y
// periodo actual tambien en 0 -- no hubo cambio real que mostrar).
function calcularDelta(actual: number, previo: number): { pct: number | null; esNuevo: boolean } {
  if (previo === 0) {
    if (actual === 0) return { pct: null, esNuevo: false };
    return { pct: null, esNuevo: true };
  }
  return { pct: ((actual - previo) / previo) * 100, esNuevo: false };
}

function DeltaBadge({
  actual,
  previo,
  direccionBuena,
}: {
  actual: number;
  previo: number | undefined | null;
  direccionBuena: DireccionBuena;
}) {
  if (previo === undefined || previo === null) return null;
  const { pct, esNuevo } = calcularDelta(actual, previo);

  if (esNuevo) {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        Nuevo
      </span>
    );
  }
  if (pct === null) return null;

  const subio = pct >= 0;
  const esMejora = direccionBuena === "sube" ? subio : !subio;
  const Icon = subio ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        esMejora ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function KpiCards({ data, previousData }: KpiCardsProps) {
  if (!data) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
    );
  }

  const mainCards = [
    {
      icon: Package, label: "Total pedidos", rawValue: data.total_pedidos, format: (n: number) => String(Math.round(n)),
      sub: `${data.pedidos_ml} ML · ${data.pedidos_fa} FA`, tone: "neutral" as const,
      previo: previousData?.total_pedidos, direccionBuena: "sube" as const,
    },
    {
      icon: DollarSign, label: "Ingresos", rawValue: data.ingresos_totales, format: (n: number) => formatCLP(Math.round(n)),
      sub: "excl. cancelados", tone: "success" as const,
      previo: previousData?.ingresos_totales, direccionBuena: "sube" as const,
    },
    {
      icon: Truck, label: "Por despachar", rawValue: data.por_despachar, format: (n: number) => String(Math.round(n)),
      sub: `${data.por_despachar_ml} ML · ${data.por_despachar_fa} FA`,
      tone: data.por_despachar > 0 ? ("warn" as const) : ("neutral" as const),
      // Tarea: hacer la tarjeta clickeable. Lleva a la lista de pedidos con
      // el filtro "Por despachar" (paid + ready_to_ship, ML y FA) ya
      // aplicado -- ver ESTADOS_FILTER/filtered en orders-table.tsx.
      href: "/pedidos?filtro=por_despachar",
      previo: previousData?.por_despachar, direccionBuena: "baja" as const,
    },
    {
      icon: XCircle, label: "Cancelados", rawValue: data.cancelados, format: (n: number) => String(Math.round(n)),
      sub: `${formatCLP(data.monto_cancelados)} excl.`,
      tone: data.cancelados > 0 ? ("danger" as const) : ("neutral" as const),
      previo: previousData?.cancelados, direccionBuena: "baja" as const,
    },
  ];

  const secondaryCards = [
    {
      icon: Receipt,
      label: "Ticket promedio",
      rawValue: data.ticket_promedio,
      format: (n: number) => formatCLP(Math.round(n)),
      sub: "ingreso por pedido",
      tone: "neutral" as const,
      previo: previousData?.ticket_promedio, direccionBuena: "sube" as const,
    },
    {
      icon: TrendingDown,
      label: "Tasa de cancelación",
      rawValue: data.tasa_cancelacion,
      format: (n: number) => `${n}%`,
      sub: data.tasa_cancelacion > 8 ? "Alta — revisar" : data.tasa_cancelacion > 5 ? "Moderada" : "Saludable",
      tone: data.tasa_cancelacion > 8 ? ("danger" as const) : data.tasa_cancelacion > 5 ? ("warn" as const) : ("success" as const),
      // Unica tarjeta donde "sube" es MALO: mas tasa de cancelacion nunca es
      // una mejora, aunque el resto de KPIs de la fila usen "sube = mejora".
      previo: previousData?.tasa_cancelacion, direccionBuena: "baja" as const,
    },
  ];

  const iconTone = {
    neutral: "bg-secondary text-muted-foreground",
    success: "bg-emerald-50 text-emerald-600",
    warn: "bg-amber-50 text-amber-600",
    danger: "bg-rose-50 text-rose-600",
  };

  const glow = {
    neutral: "",
    success: "from-emerald-500/[0.05]",
    warn: "from-amber-500/[0.06]",
    danger: "from-rose-500/[0.06]",
  };

  const valueTone = {
    neutral: "text-foreground",
    success: "text-foreground",
    warn: "text-amber-600",
    danger: "text-rose-600",
  };

  const stagger = ["stagger-1", "stagger-2", "stagger-3", "stagger-4"];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {mainCards.map((card, i) => {
          const className = cn(
            "card-premium animate-in-soft relative overflow-hidden p-4",
            stagger[i % stagger.length],
            "href" in card && card.href && "cursor-pointer transition-colors hover:border-primary/30"
          );
          const content = (
            <>
              {card.tone !== "neutral" && (
                <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", glow[card.tone])} />
              )}
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconTone[card.tone])}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <DeltaBadge actual={card.rawValue} previo={card.previo} direccionBuena={card.direccionBuena} />
                </div>
                <p className="eyebrow">{card.label}</p>
                <CountUp
                  value={card.rawValue}
                  format={card.format}
                  className={cn("tabular mt-1 block text-2xl font-semibold tracking-tight sm:text-[28px]", valueTone[card.tone])}
                />
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{card.sub}</p>
              </div>
            </>
          );

          return "href" in card && card.href ? (
            <Link key={card.label} href={card.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={card.label} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {secondaryCards.map((card, i) => (
          <div key={card.label} className={cn("card-premium animate-in-soft relative overflow-hidden p-3 sm:p-4", stagger[i % stagger.length])}>
            {card.tone !== "neutral" && (
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", glow[card.tone])} />
            )}
            <div className="relative flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconTone[card.tone])}>
                <card.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">{card.label}</p>
                  <DeltaBadge actual={card.rawValue} previo={card.previo} direccionBuena={card.direccionBuena} />
                </div>
                <CountUp
                  value={card.rawValue}
                  format={card.format}
                  className={cn("tabular block text-xl font-semibold tracking-tight sm:text-2xl", valueTone[card.tone])}
                />
                <p className="truncate text-[11px] text-muted-foreground">{card.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
