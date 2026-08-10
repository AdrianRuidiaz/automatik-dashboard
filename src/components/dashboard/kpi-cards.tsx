"use client";

import Link from "next/link";
import { Package, DollarSign, Truck, XCircle, Receipt, TrendingDown } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import type { DashboardResumen } from "@/lib/types";
import { CountUp } from "@/components/ui/count-up";

interface KpiCardsProps { data: DashboardResumen | null; }

export function KpiCards({ data }: KpiCardsProps) {
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
    },
    {
      icon: DollarSign, label: "Ingresos", rawValue: data.ingresos_totales, format: (n: number) => formatCLP(Math.round(n)),
      sub: "excl. cancelados", tone: "success" as const,
    },
    {
      icon: Truck, label: "Por despachar", rawValue: data.por_despachar, format: (n: number) => String(Math.round(n)),
      sub: `${data.por_despachar_ml} ML · ${data.por_despachar_fa} FA`,
      tone: data.por_despachar > 0 ? ("warn" as const) : ("neutral" as const),
      // Tarea: hacer la tarjeta clickeable. Lleva a la lista de pedidos con
      // el filtro "Por despachar" (paid + ready_to_ship, ML y FA) ya
      // aplicado -- ver ESTADOS_FILTER/filtered en orders-table.tsx.
      href: "/pedidos?filtro=por_despachar",
    },
    {
      icon: XCircle, label: "Cancelados", rawValue: data.cancelados, format: (n: number) => String(Math.round(n)),
      sub: `${formatCLP(data.monto_cancelados)} excl.`,
      tone: data.cancelados > 0 ? ("danger" as const) : ("neutral" as const),
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
    },
    {
      icon: TrendingDown,
      label: "Tasa de cancelación",
      rawValue: data.tasa_cancelacion,
      format: (n: number) => `${n}%`,
      sub: data.tasa_cancelacion > 8 ? "Alta — revisar" : data.tasa_cancelacion > 5 ? "Moderada" : "Saludable",
      tone: data.tasa_cancelacion > 8 ? ("danger" as const) : data.tasa_cancelacion > 5 ? ("warn" as const) : ("success" as const),
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
                <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", iconTone[card.tone])}>
                  <card.icon className="h-4 w-4" />
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
              <div className="min-w-0">
                <p className="eyebrow">{card.label}</p>
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
