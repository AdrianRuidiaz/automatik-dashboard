"use client";

import { Package, DollarSign, Truck, XCircle } from "lucide-react";
import { formatCLP } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DashboardResumen } from "@/lib/types";

interface KpiCardsProps { data: DashboardResumen | null; }

export function KpiCards({ data }: KpiCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      icon: Package,
      label: "Total pedidos",
      value: String(data.total_pedidos),
      sub: `${data.pedidos_ml} ML · ${data.pedidos_fa} FA`,
      tone: "neutral" as const,
    },
    {
      icon: DollarSign,
      label: "Ingresos",
      value: formatCLP(data.ingresos_totales),
      sub: "excl. cancelados",
      tone: "success" as const,
    },
    {
      icon: Truck,
      label: "Por despachar",
      value: String(data.por_despachar),
      sub: `${data.por_despachar_ml} ML · ${data.por_despachar_fa} FA`,
      tone: data.por_despachar > 0 ? ("warn" as const) : ("neutral" as const),
    },
    {
      icon: XCircle,
      label: "Cancelados",
      value: String(data.cancelados),
      sub: `${formatCLP(data.monto_cancelados)} excl.`,
      tone: data.cancelados > 0 ? ("danger" as const) : ("neutral" as const),
    },
  ];

  const iconTone = {
    neutral: "bg-secondary text-muted-foreground",
    success: "bg-emerald-50 text-emerald-600",
    warn: "bg-amber-50 text-amber-600",
    danger: "bg-rose-50 text-rose-600",
  };

  const valueTone = {
    neutral: "text-foreground",
    success: "text-foreground",
    warn: "text-amber-600",
    danger: "text-rose-600",
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-sm sm:p-4"
        >
          <div className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", iconTone[card.tone])}>
            <card.icon className="h-4 w-4" />
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className={cn("mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl", valueTone[card.tone])}>
            {card.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
