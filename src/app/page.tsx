"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { OrdersTable } from "@/components/pedidos/orders-table";
import { PackingCard } from "@/components/empacador/packing-card";
import { TaxDocsTable } from "@/components/vendedor/tax-docs-table";
import { ManualOrderForm } from "@/components/vendedor/manual-order-form";
import { supabase } from "@/lib/supabase";
import { fetchPedidos, fetchDashboardResumen, fetchTendenciaDiaria } from "@/lib/api";
import type { Pedido, DashboardResumen, TendenciaDiaria, RolUsuario } from "@/lib/types";
import { formatCLP } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, FileText, RefreshCw } from "lucide-react";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/types";

const pdfUrl = (url: string) => `/api/pdf?url=${encodeURIComponent(url)}`;

export default function HomePage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaDiaria[]>([]);
  const [vendedorTab, setVendedorTab] = useState<"docs" | "manual">("docs");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    try {
      const [p, r, t] = await Promise.all([
        fetchPedidos(),
        fetchDashboardResumen(),
        fetchTendenciaDiaria(7),
      ]);
      setPedidos(p);
      setResumen(r);
      setTendencia(t);
      setLastUpdate(new Date());
    } catch (err) { console.error("Error cargando datos:", err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: escuchar cambios en pedidos
  useEffect(() => {
    const channel = supabase
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const pendientes = pedidos.filter((p) =>
    ["pending", "paid", "ready_to_ship"].includes(p.estado)
  );

  return (
    <AppShell>
      {(rol: RolUsuario) => (
        <>
          {rol === "admin" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium">Resumen del periodo</h2>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">
                    Actualizado: {lastUpdate.toLocaleTimeString("es-CL")}
                  </span>
                  <button onClick={loadData} className="rounded-md border border-input p-1 text-muted-foreground hover:text-foreground hover:bg-secondary">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <select className="rounded-md border border-input bg-transparent px-2 py-1 text-xs">
                    <option>Ultimos 7 dias</option>
                    <option>Ultimos 30 dias</option>
                    <option>Este mes</option>
                  </select>
                </div>
              </div>

              <KpiCards data={resumen} />

              <div>
                <h2 className="mb-3 text-base font-medium">Tendencia diaria</h2>
                <TrendChart data={tendencia} />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-medium">Ultimos pedidos</h2>
                  <Link href="/pedidos" className="flex items-center gap-1 text-xs text-primary">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="border-b border-border px-2 py-2 font-normal">N\u00b0 pedido</th>
                      <th className="border-b border-border px-2 py-2 font-normal">Plat.</th>
                      <th className="border-b border-border px-2 py-2 font-normal">Cliente</th>
                      <th className="border-b border-border px-2 py-2 font-normal">Total</th>
                      <th className="border-b border-border px-2 py-2 font-normal">Estado</th>
                      <th className="border-b border-border px-2 py-2 font-normal">Etiqueta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.slice(0, 5).map((p) => (
                      <tr key={p.id} className="border-b border-border hover:bg-secondary/50 cursor-pointer">
                        <td className="px-2 py-2 font-medium">{p.id_plataforma}</td>
                        <td className="px-2 py-2">
                          <span className={cn("rounded px-2 py-0.5 text-[11px]",
                            p.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark"
                          )}>{p.plataforma === "ML" ? "ML" : "FA"}</span>
                        </td>
                        <td className="px-2 py-2">{p.cliente_nombre ?? "—"}</td>
                        <td className="px-2 py-2">{formatCLP(p.total_pagado)}</td>
                        <td className="px-2 py-2">
                          <span className={cn("rounded px-2 py-0.5 text-[11px]", ESTADO_COLORS[p.estado])}>
                            {ESTADO_LABELS[p.estado]}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {p.etiqueta_url ? (
                            <button onClick={() => window.open(pdfUrl(p.etiqueta_url!), "_blank")} className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 text-red-500" /> PDF
                            </button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rol === "empacador" && (
            <div className="space-y-3">
              <h2 className="text-base font-medium">Pedidos por empacar</h2>
              {pendientes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos pendientes de empaque</p>
              ) : pendientes.map((p) => <PackingCard key={p.id} pedido={p} onConfirm={loadData} />)}
            </div>
          )}

          {rol === "vendedor" && (
            <div>
              <div className="mb-5 flex gap-1">
                <button onClick={() => setVendedorTab("docs")} className={cn("rounded-md px-3 py-1.5 text-sm", vendedorTab === "docs" ? "bg-secondary font-medium" : "text-muted-foreground")}>Documentos tributarios</button>
                <button onClick={() => setVendedorTab("manual")} className={cn("rounded-md px-3 py-1.5 text-sm", vendedorTab === "manual" ? "bg-secondary font-medium" : "text-muted-foreground")}>Ingresar pedido manual</button>
              </div>
              {vendedorTab === "docs" && <TaxDocsTable pedidos={pedidos} />}
              {vendedorTab === "manual" && <ManualOrderForm />}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
