"use client";

import { Package, DollarSign, Truck, X } from "lucide-react";
import { formatCLP } from "@/lib/utils";
import type { DashboardResumen } from "@/lib/types";

interface KpiCardsProps {
  data: DashboardResumen | null;
}

export function KpiCards({ data }: KpiCardsProps) {
  if (!data) return null;

  const cards = [
    {
      icon: Package,
      label: "Total pedidos",
      value: String(data.total_pedidos),
      sub: `${data.pedidos_ml} ML + ${data.pedidos_fa} FA`,
    },
    {
      icon: DollarSign,
      label: "Ingresos",
      value: formatCLP(data.ingresos_totales),
      sub: "excl. cancelados",
    },
    {
      icon: Truck,
      label: "Por despachar",
      value: String(data.por_despachar),
      sub: `${data.por_despachar_ml} ML + ${data.por_despachar_fa} FA`,
      warn: data.por_despachar > 0,
    },
    {
      icon: X,
      label: "Cancelados",
      value: String(data.cancelados),
      sub: `${formatCLP(data.monto_cancelados)} excl.`,
      danger: data.cancelados > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <card.icon className="h-3.5 w-3.5" />
            {card.label}
          </div>
          <div
            className={`text-xl font-medium ${
              card.warn
                ? "text-amber-600"
                : card.danger
                ? "text-red-600"
                : ""
            }`}
          >
            {card.value}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
