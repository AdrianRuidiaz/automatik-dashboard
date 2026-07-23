"use client";

import { Package, DollarSign, Truck, XCircle } from "lucide-react";
import { formatCLP, cn } from "@/lib/utils";
import type { DashboardResumen } from "@/lib/types";

interface KpiCardsProps { data: DashboardResumen | null; }

export function KpiCards({ data }: KpiCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  const cards = [
    { icon: Package, label: "Total pedidos", value: String(data.total_pedidos),
      sub: `${data.pedidos_ml} ML · ${data.pedidos_fa} FA`, tone: "neutral" as const },
    { icon: DollarSign, label: "Ingresos", value: formatCLP(data.ingresos_totales),
      sub: "excl. cancelados", tone: "success" as const },
    { icon: Truck, label: "Por despachar", value: String(data.por_despachar),
      sub: `${data.por_despachar_ml} ML · ${data.por_despachar_fa} FA`,
      tone: data.por_despachar > 0 ? ("warn" as const) : ("neutral" as const) },
    { icon: XCircle, label: "Cancelados", value: String(data.cancelados),
      sub: `${formatCLP(data.monto_cancelados)} excl.`,
      tone: data.cancelados > 0 ? ("danger" as const) : ("neutral" as const) },
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

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="card-premium relative overflow-hidden p-4">
          {card.tone !== "neutral" && (
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", glow[card.tone])} />
          )}
          <div className="relative">
            <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", iconTone[card.tone])}>
              <card.icon className="h-4 w-4" />
            </div>
            <p className="eyebrow">{card.label}</p>
            <p className={cn("tabular mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]", valueTone[card.tone])}>
              {card.value}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
