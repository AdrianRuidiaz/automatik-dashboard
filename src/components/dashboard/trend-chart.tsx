"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TendenciaDiaria } from "@/lib/types";

interface TrendChartProps {
  data: TendenciaDiaria[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto tabular font-semibold text-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((d) => ({
    fecha: new Date(d.fecha).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
    }),
    "Mercado Libre": d.pedidos_ml,
    Falabella: d.pedidos_fa,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sin datos de tendencia para este periodo
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          Mercado Libre
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Falabella
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradML" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eab308" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradFA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(40 10% 92%)"
            vertical={false}
          />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 11, fill: "hsl(240 5% 48%)" }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(240 5% 48%)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "#eab308", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.4 }}
          />
          <Area
            type="monotone"
            dataKey="Mercado Libre"
            stroke="#eab308"
            strokeWidth={2.5}
            fill="url(#gradML)"
            dot={{ r: 3, fill: "#eab308", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#eab308", strokeWidth: 2, stroke: "#fff" }}
          />
          <Area
            type="monotone"
            dataKey="Falabella"
            stroke="#22c55e"
            strokeWidth={2.5}
            fill="url(#gradFA)"
            dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
