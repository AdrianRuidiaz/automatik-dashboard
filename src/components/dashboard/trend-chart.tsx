"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TendenciaDiaria } from "@/lib/types";

interface TrendChartProps {
  data: TendenciaDiaria[];
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((d) => ({
    fecha: new Date(d.fecha).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
    }),
    ML: d.pedidos_ml,
    Falabella: d.pedidos_fa,
  }));

  return (
    <div className="rounded-xl bg-card p-4">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barGap={2}>
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="ML" fill="#378ADD" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Falabella" fill="#EF9F27" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
